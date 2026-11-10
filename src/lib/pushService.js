import { supabase } from './supabase';

let cachedVapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export async function getVapidPublicKey() {
  try {
    const res = await fetch('/api/push-config', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.vapidPublicKey) {
        cachedVapidPublicKey = data.vapidPublicKey;
      }
    }
  } catch (e) {
    // Offline fallback to build-time env var
  }
  return cachedVapidPublicKey;
}

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

  const vapidPublicKey = await getVapidPublicKey();
  if (!vapidPublicKey) {
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
  if (sub) {
    try {
      const currentKeyBytes = urlBase64ToUint8Array(vapidPublicKey);
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
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
  }

  return sub;
}

async function persistSubscriptionForTeams(userId, targetTeams, subscriptionJson, endpoint, deviceType, userAgent) {
  for (const t of targetTeams) {
    if (!t.team_id) continue;

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('save_push_subscription', {
      p_team_id: t.team_id,
      p_subscription: subscriptionJson,
      p_device_type: deviceType,
      p_user_agent: userAgent
    });

    if (!rpcErr && rpcRes?.success) {
      continue;
    }

    const { error } = await supabase.from('user_push_subscriptions').upsert({
      user_id: userId,
      team_id: t.team_id,
      subscription: subscriptionJson,
      endpoint: endpoint,
      device_type: deviceType,
      user_agent: userAgent,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,team_id,endpoint' });

    if (error) {
      console.warn('Upsert subscription error, trying fallback insert:', error.message);
      await supabase.from('user_push_subscriptions').insert({
        user_id: userId,
        team_id: t.team_id,
        subscription: subscriptionJson,
        endpoint: endpoint,
        device_type: deviceType,
        user_agent: userAgent
      });
    }
  }
}

/**
 * Persists current device's subscription (Native Android FCM and/or Browser Web Push) into Supabase.
 */
export async function syncPushSubscriptionWithDatabase(userId, teamId = null) {
  if (!userId) return false;

  try {
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
      return false;
    }

    let synced = false;

    // 1. Sync Native Android FCM token first (works inside Android WebView even without PushManager)
    const nativeFcmToken =
      (typeof window !== 'undefined' && window.TeamSpaceNative?.getNativeFcmToken?.()) ||
      (typeof window !== 'undefined' && window.__TEAMSPACE_NATIVE_FCM_TOKEN__);

    if (nativeFcmToken) {
      const nativeEndpoint = `https://fcm.googleapis.com/fcm/send/${nativeFcmToken}`;
      await persistSubscriptionForTeams(
        userId,
        targetTeams,
        { endpoint: nativeEndpoint, fcm_token: nativeFcmToken },
        nativeEndpoint,
        'android_native',
        'TeamSpaceNativeApp/1.0'
      );
      synced = true;
    }

    // 2. Sync Browser Web Push subscription when supported
    const sub = await getOrRegisterPushSubscription();
    if (sub) {
      const subJson = sub.toJSON();
      const endpoint = sub.endpoint || subJson.endpoint;
      const isAndroid = /Android/i.test(navigator.userAgent);
      const deviceType = isAndroid ? 'android' : /Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

      await persistSubscriptionForTeams(
        userId,
        targetTeams,
        subJson,
        endpoint,
        deviceType,
        navigator.userAgent.substring(0, 150)
      );
      synced = true;
    }

    return synced;
  } catch (err) {
    console.warn('Push sync error:', err);
    return false;
  }
}

/**
 * Dispatches an authenticated Push Notification via Cloudflare Worker backend.
 */
export async function dispatchPushNotification({ teamId, userId, title, message, url, tag }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) return { success: false };

    const payload = {
      team_id: teamId,
      user_id: userId,
      title,
      message,
      target_url: url || window.location.origin + '/#/workspace',
      tag: tag || 'teamspace-alert'
    };

    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, ...result };
    }
  } catch (e) {
    console.warn('Push endpoint error:', e);
  }

  return { success: false };
}

/**
 * Sends an authenticated test push to this device via Google FCM.
 */
export async function sendTestPushToDevice() {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Authentication required to send test push.');
  }

  const sub = await getOrRegisterPushSubscription();
  if (!sub) {
    throw new Error('Unable to retrieve push subscription from browser. Please enable notifications.');
  }

  const response = await fetch('/api/test-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
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
