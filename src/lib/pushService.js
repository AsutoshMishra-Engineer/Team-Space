import { supabase } from './supabase';

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BKuFBD8j1g_XMZUERp_peqjjDG7goKONB5zNdMooaomsvfrTwkRj6xj611Jbul_9K68rvMLKlz8zvH2b4xDqp2k';

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register Service Worker and retrieve a valid PushSubscription.
 * Unsubscribes stale/mismatched subscriptions automatically.
 */
export async function getOrRegisterPushSubscription() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }
  reg = await navigator.serviceWorker.ready;
  if (!reg || !reg.pushManager) return null;

  let sub = await reg.pushManager.getSubscription();

  // If sub exists, verify if it was created with current VAPID key
  // If not, unsubscribe to refresh with verified key
  if (sub) {
    try {
      const currentKeyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subKey = sub.options?.applicationServerKey;
      if (subKey) {
        const subKeyBytes = new Uint8Array(subKey);
        let matches = subKeyBytes.length === currentKeyBytes.length;
        if (matches) {
          for (let i = 0; i < subKeyBytes.length; i++) {
            if (subKeyBytes[i] !== currentKeyBytes[i]) {
              matches = false;
              break;
            }
          }
        }
        if (!matches) {
          console.log('🔄 Refreshing outdated Web Push subscription key...');
          await sub.unsubscribe();
          sub = null;
        }
      }
    } catch (e) {
      console.warn('Subscription key check note:', e);
    }
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  return sub;
}

/**
 * Persists current device's Google FCM subscription into Supabase.
 */
export async function syncPushSubscriptionWithDatabase(userId, teamId = null) {
  if (!userId) return false;

  try {
    const sub = await getOrRegisterPushSubscription();
    if (!sub) return false;

    const subJson = sub.toJSON();
    const endpoint = sub.endpoint || subJson.endpoint;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const deviceType = isAndroid ? 'android' : /Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

    let targetTeams = [];
    if (teamId) {
      targetTeams = [{ team_id: teamId }];
    } else {
      const { data: teams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .eq('status', 'active');
      targetTeams = teams || [];
    }

    if (targetTeams.length === 0) {
      // User might be in personal workspace or just joined
      targetTeams = [{ team_id: null }];
    }

    // Check if running inside native TeamSpace Android App wrapper
    const nativeFcmToken = (typeof window !== 'undefined' && window.TeamSpaceNative?.getNativeFcmToken?.()) || window.__TEAMSPACE_NATIVE_FCM_TOKEN__;
    if (nativeFcmToken) {
      for (const t of targetTeams) {
        if (!t.team_id) continue;
        await supabase.from('user_push_subscriptions').upsert({
          user_id: userId,
          team_id: t.team_id,
          subscription: { fcm_token: nativeFcmToken },
          endpoint: `https://fcm.googleapis.com/fcm/send/${nativeFcmToken}`,
          device_type: 'android_native',
          user_agent: 'TeamSpaceNativeApp/1.0',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,team_id,endpoint' }).catch(() => {});
      }
    }

    for (const t of targetTeams) {
      if (!t.team_id) continue;

      // 1. Try secure RPC
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('save_push_subscription', {
        p_team_id: t.team_id,
        p_subscription: subJson,
        p_device_type: deviceType,
        p_user_agent: navigator.userAgent.substring(0, 150)
      });

      if (!rpcErr && rpcRes?.success) {
        continue;
      }

      // 2. Fallback upsert
      const { error } = await supabase.from('user_push_subscriptions').upsert({
        user_id: userId,
        team_id: t.team_id,
        subscription: subJson,
        endpoint: endpoint,
        device_type: deviceType,
        user_agent: navigator.userAgent.substring(0, 150),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,team_id,endpoint' });

      if (error) {
        console.warn('Upsert subscription error, trying fallback insert:', error.message);
        await supabase.from('user_push_subscriptions').insert({
          user_id: userId,
          team_id: t.team_id,
          subscription: subJson,
          endpoint: endpoint,
          device_type: deviceType,
          user_agent: navigator.userAgent.substring(0, 150)
        });
      }
    }

    return true;
  } catch (err) {
    console.warn('Push sync error:', err);
    return false;
  }
}

/**
 * Dispatches a real Web Push to Google FCM via Cloudflare Worker backend.
 */
export async function dispatchPushNotification({ teamId, userId, title, message, url, tag }) {
  // Try to pre-fetch subscriptions using client's authenticated session
  let directSubscriptions = [];
  if (teamId) {
    try {
      const { data } = await supabase
        .from('user_push_subscriptions')
        .select('id, user_id, subscription')
        .eq('team_id', teamId);
      if (data && data.length > 0) {
        directSubscriptions = data;
      }
    } catch (e) {}
  }

  const payload = {
    team_id: teamId,
    user_id: userId,
    title,
    message,
    target_url: url || window.location.origin + '/#/workspace',
    tag: tag || 'teamspace-alert',
    direct_subscriptions: directSubscriptions
  };

  try {
    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Web Push dispatched via Cloudflare:', result);
      return { success: true, ...result };
    }
  } catch (e) {
    console.warn('Push endpoint error:', e);
  }

  return { success: false };
}

/**
 * Sends an immediate real test push to this device via Google FCM.
 */
export async function sendTestPushToDevice() {
  const sub = await getOrRegisterPushSubscription();
  if (!sub) {
    throw new Error('Unable to retrieve push subscription from browser. Please enable notifications.');
  }

  const response = await fetch('/api/test-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      title: '📢 TeamSpace Android Push Test',
      message: '🚀 Real Web Push delivered through Google FCM to your Android notification tray!'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Push test failed: ' + errText);
  }

  return await response.json();
}
