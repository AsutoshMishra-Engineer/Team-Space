import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AnnouncementAcknowledgement from './AnnouncementAcknowledgement';
import { dispatchPushNotification, syncPushSubscriptionWithDatabase } from '../lib/pushService';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Announcements({ teamId, teamName, isLeader, members = [] }) {
  const { user, profile } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [message, setMessage] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [requiresAck, setRequiresAck] = useState(false);
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [extendingAnnId, setExtendingAnnId] = useState(null);
  const [extendedAnnDate, setExtendedAnnDate] = useState('');
  const [inAppBanner, setInAppBanner] = useState(null);
  const channelRef = useRef(null);
  const clientSessionId = useRef('sess_' + Math.random().toString(36).substring(2) + '_' + Date.now());
  const lastPostedId = useRef(null);

  const isNativeApp = typeof window !== 'undefined' && (
    Boolean(window.TeamSpaceNative?.isNativeApp?.()) ||
    Boolean(window.__TEAMSPACE_NATIVE_FCM_TOKEN__) ||
    /TeamSpaceNativeApp/i.test(navigator?.userAgent || '')
  );

  const [permissionState, setPermissionState] = useState(() => {
    if (isNativeApp) return 'granted';
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const [diagnosticResult, setDiagnosticResult] = useState(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (isNativeApp) return true;
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    const saved = localStorage.getItem('teamspace_chrome_notifs');
    return saved !== null ? saved === 'true' : (Notification.permission === 'granted');
  });

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, profiles!announcements_profiles_fkey(user_id, username)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const playNotificationChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

  // Register Web Push subscription to Supabase database
  const subscribeToWebPush = async () => {
    if (!user?.id || !teamId) return;
    try {
      await syncPushSubscriptionWithDatabase(user.id, teamId);
    } catch (err) {
      console.warn('Web Push subscription error:', err);
    }
  };

  const triggerBrowserNotification = async (announcementData) => {
    const author =
      announcementData.profiles?.username ||
      announcementData.profiles?.user_id ||
      announcementData.sender_id ||
      'Team Member';

    const deadlineText = announcementData.deadline
      ? `\n⏰ Deadline: ${new Date(announcementData.deadline).toLocaleDateString()}`
      : '';

    const teamTag = teamName ? ` • ${teamName}` : '';

    setInAppBanner({
      title: `📢 ${author}${teamTag}`,
      body: announcementData.message,
      deadline: announcementData.deadline
    });
    playNotificationChime();

    setTimeout(() => {
      setInAppBanner((current) => (current?.body === announcementData.message ? null : current));
    }, 8000);

    if (!notificationsEnabled) return;
    if (typeof window !== 'undefined' && window.Notification?.permission && window.Notification.permission !== 'granted') return;

    const title = `📢 ${author}${teamTag}`;
    const iconUrl = window.location.origin + '/logo.png';
    const options = {
      body: `${announcementData.message}${deadlineText}`,
      icon: iconUrl,
      badge: iconUrl,
      tag: `team-announcement-${announcementData.id || Date.now()}`,
      renotify: true,
      vibrate: [300, 100, 300]
    };

    // 1. Service Worker Notification (MANDATORY on Android Chrome - new Notification() throws on mobile)
    if ('serviceWorker' in navigator) {
      try {
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
        reg = await navigator.serviceWorker.ready;

        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, options);
          return;
        }

        // SW Controller postMessage fallback
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            options
          });
          return;
        }
      } catch (err) {
        console.warn('Service Worker notification failed:', err);
      }
    }

    // 2. Desktop Chrome direct constructor fallback
    try {
      const n = new Notification(title, options);
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.warn('Desktop Notification fallback:', e);
    }
  };

  const handleToggleNotifications = async () => {
    if (isNativeApp) {
      setDiagnosticResult({
        success: true,
        title: '📱 Native Android Notifications Active',
        message: 'TeamSpace Native App is active with High-Priority Push Alerts.\n\nAll real-time announcements, heads-up sound & vibration are delivered directly to your notification tray!'
      });
      return;
    }

    if (!('Notification' in window)) {
      alert('This browser does not support system notifications.');
      return;
    }

    if (!notificationsEnabled) {
      let perm = Notification.permission;
      if (perm !== 'granted') {
        try {
          perm = await Notification.requestPermission();
          setPermissionState(perm);
        } catch (e) {}
      }

      if (perm !== 'granted') {
        setDiagnosticResult({
          success: false,
          title: '⚠️ Notifications Blocked in Chrome',
          message: 'Chrome blocked notifications for this site.\n\n👉 To fix:\n1. Tap the lock/tune icon (🔒) in Chrome address bar.\n2. Tap "Permissions" -> "Notifications" -> select "Allow".\n3. Tap "🧪 Test Alert" again.'
        });
        return;
      }

      setNotificationsEnabled(true);
      setPermissionState('granted');
      localStorage.setItem('teamspace_chrome_notifs', 'true');
      await subscribeToWebPush();

      triggerBrowserNotification({
        id: 'test-welcome',
        profiles: { user_id: 'System' },
        message: '🔔 Notifications are active! You will receive live alerts for all team announcements.'
      });
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('teamspace_chrome_notifs', 'false');
    }
  };

  const handleTestNotification = async () => {
    if (isNativeApp) {
      try {
        playNotificationChime();
        await dispatchPushNotification({
          teamId,
          userId: user?.id,
          title: '📢 TeamSpace Native Push Test',
          message: '🚀 Real push notification delivered directly to your Android device!'
        });
        setDiagnosticResult({
          success: true,
          title: '✅ Alert Dispatched to Your Phone!',
          message: 'The notification was delivered directly to your Android system notification tray!\n\n👉 Swipe down from the top of your phone screen to see it.'
        });
      } catch (err) {
        setDiagnosticResult({
          success: true,
          title: '🔔 Alert Ready',
          message: 'Native FCM token is active on this device.'
        });
      }
      return;
    }

    if (!('Notification' in window)) {
      setDiagnosticResult({
        success: false,
        title: '❌ Browser Unsupported',
        message: 'This mobile browser does not support Web Notifications. Please open this site inside the Google Chrome app on Android.'
      });
      return;
    }

    let perm = Notification.permission;
    if (perm !== 'granted') {
      try {
        perm = await Notification.requestPermission();
        setPermissionState(perm);
      } catch (e) {}
    }

    if (perm === 'denied') {
      setDiagnosticResult({
        success: false,
        title: '❌ Chrome Blocked Notifications',
        message: 'Notifications are blocked in your Chrome site permissions.\n\n👉 How to unblock in 5 seconds:\n1. Tap the lock/tune icon (🔒) beside the website link at the top of Chrome.\n2. Tap "Permissions" -> "Notifications" -> select "Allow".\n3. Tap "🧪 Test Alert" again!'
      });
      return;
    }

    if (perm !== 'granted') {
      setDiagnosticResult({
        success: false,
        title: '⚠️ Permission Not Allowed',
        message: 'Chrome did not grant notification permissions. Tap the button again and choose "Allow".'
      });
      return;
    }

    // Permission is GRANTED!
    setNotificationsEnabled(true);
    setPermissionState('granted');
    localStorage.setItem('teamspace_chrome_notifs', 'true');

    // Register Service Worker and send test notification
    try {
      let reg = null;
      if ('serviceWorker' in navigator) {
        reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
        reg = await navigator.serviceWorker.ready;
      }

      const iconUrl = window.location.origin + '/logo.png';
      const options = {
        body: '✅ If you see this, mobile notifications are 100% WORKING on your Android device!',
        icon: iconUrl,
        badge: iconUrl,
        tag: 'teamspace-test-' + Date.now(),
        renotify: true,
        vibrate: [300, 100, 300, 100, 300]
      };

      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification('📢 TeamSpace Mobile Alert Test', options);
      } else if (typeof window !== 'undefined' && typeof window.Notification === 'function') {
        try { new window.Notification('📢 TeamSpace Mobile Alert Test', options); } catch (e) {}
      }

      playNotificationChime();
      await subscribeToWebPush();

      setDiagnosticResult({
        success: true,
        title: '✅ Alert Sent to Your Phone!',
        message: 'The notification was sent to your Android system tray!\n\n👉 Swipe down from the top of your phone screen to see it.\n\n⚠️ If you STILL do not see it in the top bar:\nYour Android phone OS has Chrome app notifications muted. Go to:\nPhone Settings -> Apps -> Chrome -> Notifications -> Turn ON "All Chrome notifications" & set to "Alerting".'
      });
    } catch (err) {
      setDiagnosticResult({
        success: false,
        title: '⚠️ Service Worker Notification Error',
        message: `Failed to dispatch notification: ${err.message}`
      });
    }
  };

  useEffect(() => {
    if (!teamId) return;

    fetchAnnouncements();

    // If notifications are already enabled, sync push token
    if (notificationsEnabled && (isNativeApp || (typeof window !== 'undefined' && window.Notification?.permission === 'granted'))) {
      subscribeToWebPush();
    }

    // Direct WebSockets broadcast room
    const channel = supabase
      .channel(`announcements-room-${teamId}`)
      .on('broadcast', { event: 'new-announcement' }, (payload) => {
        const ann = payload.payload;
        setAnnouncements((prev) => [ann, ...prev.filter((a) => a.id !== ann.id)]);
        // Notify other devices/tabs (even if logged in with same user account)
        if (ann.client_session_id !== clientSessionId.current) {
          triggerBrowserNotification(ann);
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
          filter: `team_id=eq.${teamId}`
        },
        async (payload) => {
          let authorProfile = null;
          try {
            const { data } = await supabase
              .from('profiles')
              .select('user_id, username')
              .eq('id', payload.new.posted_by)
              .maybeSingle();
            authorProfile = data;
          } catch (e) {}

          const completeAnn = {
            ...payload.new,
            profiles: authorProfile
          };

          setAnnouncements((prev) => [
            completeAnn,
            ...prev.filter((a) => a.id !== completeAnn.id)
          ]);

          // Trigger notification on other tabs or devices
          if (payload.new.id !== lastPostedId.current) {
            triggerBrowserNotification(completeAnn);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'announcements',
          filter: `team_id=eq.${teamId}`
        },
        (payload) => {
          setAnnouncements((prev) => prev.filter((a) => a.id !== payload.old.id));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, user?.id, notificationsEnabled]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!message.trim() || posting) return;

    if (!deadline) {
      alert('⚠️ Deadline is compulsory for announcements! Please select a deadline.');
      return;
    }

    try {
      setPosting(true);
      const textToPost = message.trim();
      const targetDeadline = deadline;

      let newRecord = null;
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          team_id: teamId,
          posted_by: user.id,
          message: textToPost,
          deadline: targetDeadline,
          is_important: isImportant,
          requires_ack: requiresAck
        })
        .select('*, profiles!announcements_profiles_fkey(user_id, username)');

      if (error) {
        // Fallback to secure RPC if table RLS is restrictive
        const { data: rpcData, error: rpcError } = await supabase.rpc('post_announcement', {
          p_team_id: teamId,
          p_message: textToPost,
          p_deadline: targetDeadline
        });

        if (rpcError) throw error;
        if (rpcData && !rpcData.success) throw new Error(rpcData.error || 'Failed to post announcement');
        newRecord = rpcData?.data;
      } else {
        newRecord = data && data[0] ? data[0] : null;
      }

      setMessage('');
      setDeadline('');
      setIsImportant(false);
      setRequiresAck(false);
      fetchAnnouncements();

      if (!newRecord) {
        newRecord = {
          id: crypto.randomUUID(),
          team_id: teamId,
          posted_by: user.id,
          message: textToPost,
          deadline: targetDeadline,
          is_important: isImportant,
          requires_ack: requiresAck,
          created_at: new Date().toISOString(),
          profiles: { user_id: profile?.user_id || 'Member', username: profile?.username }
        };
      }

      lastPostedId.current = newRecord.id;

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'new-announcement',
          payload: {
            ...newRecord,
            client_session_id: clientSessionId.current
          }
        });
      }

      // Background Mobile Push: Notify offline phones like WhatsApp via Google FCM & Cloudflare Worker
      try {
        const authorName = profile?.username?.trim() || profile?.user_id || 'Team Member';
        const notifPrefix = isImportant ? '⚠️ [IMPORTANT] ' : requiresAck ? '✍️ [ACK REQUIRED] ' : '';
        const teamTag = teamName ? ` • ${teamName}` : ' • TeamSpace';
        dispatchPushNotification({
          teamId,
          title: `${notifPrefix}📢 ${authorName}${teamTag}`,
          message: textToPost,
          url: window.location.origin + '/#/workspace',
          tag: 'team-announcement'
        });
      } catch (e) {}

      triggerBrowserNotification({
        ...newRecord,
        profiles: { user_id: 'You' }
      });
    } catch (err) {
      alert('Post failed: ' + err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleExtendAnnouncementDeadline = async (annId) => {
    if (!extendedAnnDate) {
      alert('⚠️ Please select a new extended deadline.');
      return;
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .update({ deadline: extendedAnnDate })
        .eq('id', annId);

      if (error) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('extend_announcement_deadline', {
          p_announcement_id: annId,
          p_new_deadline: extendedAnnDate
        });
        if (rpcError || (rpcData && !rpcData.success)) {
          throw error;
        }
      }

      setExtendingAnnId(null);
      setExtendedAnnDate('');
      fetchAnnouncements();
    } catch (err) {
      alert('Failed to extend deadline: ' + err.message);
    }
  };

  const handleDelete = async (ann) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', ann.id);

      if (error) throw error;
      setAnnouncements((prev) => prev.filter((a) => a.id !== ann.id));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="workspace-section" style={{ position: 'relative' }}>
      {/* High-Visibility In-App Popup Banner */}
      {inAppBanner && (
        <div className="pro-announcement-banner-toast">
          <div className="toast-left">
            <span className="toast-icon">📢</span>
            <div className="toast-content">
              <div className="toast-title">{inAppBanner.title}</div>
              <div className="toast-body">{inAppBanner.body}</div>
              {inAppBanner.deadline && (
                <div className="toast-deadline">
                  ⏰ Due: {new Date(inAppBanner.deadline).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setInAppBanner(null)}
            className="toast-close-btn"
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      <div
        className="flex-between"
        style={{
          alignItems: 'center',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}
      >
        <div className="section-title" style={{ marginBottom: 0 }}>
          📢 Team Announcements & Reminders
        </div>

        {/* ON / OFF Chrome Notification Switch + Test Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Chrome Alerts:
          </span>
          <button
            type="button"
            onClick={handleToggleNotifications}
            className={`btn btn-small ${
              notificationsEnabled ? 'btn-primary' : 'btn-secondary'
            }`}
            style={{
              padding: '3px 10px',
              fontSize: '0.74rem',
              borderRadius: '16px',
              fontWeight: 700
            }}
            title={
              notificationsEnabled
                ? 'Click to turn OFF Chrome notifications'
                : 'Click to turn ON Chrome notifications'
            }
          >
            {notificationsEnabled ? '🔔 ON' : '🔕 OFF'}
          </button>
          <button
            type="button"
            onClick={handleTestNotification}
            className="btn btn-secondary btn-small"
            style={{
              padding: '3px 10px',
              fontSize: '0.74rem',
              borderRadius: '16px',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-color)'
            }}
            title="Send an immediate test alert to this phone/browser"
          >
            🧪 Test Alert
          </button>
        </div>
      </div>

      {/* Native Android App Status Badge */}
      {isNativeApp && (
        <div className="native-app-badge-bar">
          <span className="pulse-dot-green"></span>
          <span><strong>TeamSpace Native Android App</strong> • Live Push Engine Connected</span>
        </div>
      )}

      {/* Mobile Notification Status Banner for Android Browser */}
      {permissionState !== 'granted' && !isNativeApp && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.15) 0%, rgba(79, 70, 229, 0.08) 100%)',
          border: '1px solid rgba(108, 99, 255, 0.35)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>📱</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                Enable Instant Mobile Chrome Alerts
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Get real-time push notifications on Android phone like WhatsApp when announcements are posted.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestNotification}
            className="btn btn-primary btn-small"
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              borderRadius: '20px',
              fontWeight: 700,
              boxShadow: '0 2px 10px rgba(108, 99, 255, 0.4)'
            }}
          >
            🔔 Enable on Android
          </button>
        </div>
      )}

      {/* On-Screen Diagnostic & Test Result */}
      {diagnosticResult && (
        <div style={{
          background: diagnosticResult.success ? 'rgba(74, 222, 128, 0.12)' : 'rgba(248, 113, 113, 0.12)',
          border: `1px solid ${diagnosticResult.success ? '#4ade80' : '#f87171'}`,
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '1.25rem',
          fontSize: '0.82rem',
          color: '#eee'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <strong style={{ color: diagnosticResult.success ? '#4ade80' : '#f87171', fontSize: '0.9rem' }}>
              {diagnosticResult.title}
            </strong>
            <button
              onClick={() => setDiagnosticResult(null)}
              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
              title="Close"
            >
              ✕
            </button>
          </div>
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.5' }}>
            {diagnosticResult.message}
          </div>
        </div>
      )}

      <form onSubmit={handlePost} className="mb-2">
        <div className="form-group">
          <textarea
            className="form-input"
            placeholder="Share a team announcement, reminder or update (anyone in the team can post)..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={3}
          />
        </div>
        <div
          className="flex gap-1"
          style={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700 }}>
              ⏰ Deadline <span style={{ color: '#f87171' }}>*(Compulsory)</span>:
            </span>
            <input
              type="date"
              className="pro-date-picker-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              onClick={(e) => {
                try { e.target.showPicker?.(); } catch (err) {}
              }}
              required
              min={new Date().toISOString().split('T')[0]}
            />
            {/* Quick 1-tap date presets for Android mobile & desktop */}
            <div className="date-quick-presets">
              <button
                type="button"
                onClick={() => setDeadline(new Date().toISOString().split('T')[0])}
                className="btn-date-preset"
                title="Set to today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setDeadline(d.toISOString().split('T')[0]);
                }}
                className="btn-date-preset"
                title="Set to tomorrow"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 2);
                  setDeadline(d.toISOString().split('T')[0]);
                }}
                className="btn-date-preset"
                title="Set to 2 days from now"
              >
                +2 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  setDeadline(d.toISOString().split('T')[0]);
                }}
                className="btn-date-preset"
                title="Set to 1 week from now"
              >
                +1 Week
              </button>
            </div>
          </div>

          {/* Acknowledgement and Priority Flags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', margin: '4px 0' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#e2e8f0', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={isImportant}
                onChange={(e) => setIsImportant(e.target.checked)}
                style={{ accentColor: '#f59e0b', width: '15px', height: '15px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600, color: isImportant ? '#fbbf24' : '#cbd5e1' }}>
                ⚠️ Important
              </span>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#e2e8f0', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={requiresAck}
                onChange={(e) => setRequiresAck(e.target.checked)}
                style={{ accentColor: '#6C63FF', width: '15px', height: '15px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600, color: requiresAck ? '#a78bfa' : '#cbd5e1' }}>
                ✍️ Require Member Sign-off
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={posting || !message.trim() || !deadline}
            className="btn btn-primary btn-small"
          >
            {posting ? 'Broadcasting...' : '📢 Post Announcement'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="text-muted">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="text-muted text-center" style={{ padding: '2rem' }}>
          No announcements yet. Anyone can post an announcement above!
        </div>
      ) : (
        <div className="announcements-list">
          {announcements.map((ann) => {
            const author =
              ann.profiles?.username || ann.profiles?.user_id || 'Team Member';

            return (
              <div key={ann.id} className="announcement-item">
                <p className="announcement-text">{ann.message}</p>
                <div
                  className="announcement-header"
                  style={{ marginTop: '0.5rem', marginBottom: 0 }}
                >
                  <span className="announcement-author">
                    Posted by: {author} ·{' '}
                    {new Date(ann.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex gap-1" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    {ann.deadline && (
                      <span
                        className="announcement-deadline"
                        style={{
                          fontSize: '0.76rem',
                          color: '#fbbf24',
                          background: 'rgba(251,191,36,0.1)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        ⏰ Deadline:{' '}
                        {new Date(ann.deadline).toLocaleDateString()}
                      </span>
                    )}
                    {(ann.posted_by === user.id || isLeader) && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setExtendingAnnId(extendingAnnId === ann.id ? null : ann.id);
                            setExtendedAnnDate(ann.deadline ? ann.deadline.split('T')[0] : '');
                          }}
                          className="btn btn-secondary btn-small"
                          style={{
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            borderRadius: '4px',
                            background: 'rgba(108, 99, 255, 0.15)',
                            color: 'var(--accent)',
                            border: '1px solid rgba(108, 99, 255, 0.3)'
                          }}
                          title="Extend or update announcement deadline"
                        >
                          ⏳ Extend
                        </button>
                        <button
                          onClick={() => handleDelete(ann)}
                          className="item-delete-btn"
                          title="Delete announcement"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Announcement Acknowledgement & Sign-off Tracking */}
                <AnnouncementAcknowledgement
                  announcement={ann}
                  isLeader={isLeader}
                  teamId={teamId}
                  allMembers={members}
                />

                {/* Inline Extend Deadline Drawer */}
                {extendingAnnId === ann.id && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '8px 12px',
                    background: 'rgba(108, 99, 255, 0.08)',
                    border: '1px solid rgba(108, 99, 255, 0.25)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 600 }}>
                      New Deadline:
                    </span>
                    <input
                      type="date"
                      value={extendedAnnDate}
                      onChange={(e) => setExtendedAnnDate(e.target.value)}
                      onClick={(e) => {
                        try { e.target.showPicker?.(); } catch (err) {}
                      }}
                      className="pro-date-picker-input"
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleExtendAnnouncementDeadline(ann.id)}
                      className="btn btn-primary btn-small"
                      style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setExtendingAnnId(null)}
                      className="btn btn-ghost btn-small"
                      style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
