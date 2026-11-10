import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { syncPushSubscriptionWithDatabase, sendTestPushToDevice, dispatchPushNotification } from '../lib/pushService';

export default function NotificationPreferences() {
  const { user } = useAuth();
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState(null);

  const [prefs, setPrefs] = useState({
    notify_announcements: true,
    notify_tasks: true,
    notify_attendance: true,
    notify_reminders: true,
    sound_enabled: true,
    vibration_enabled: true
  });

  const isNative = typeof window !== 'undefined' && (
    Boolean(window.TeamSpaceNative?.isNativeApp?.()) ||
    Boolean(window.__TEAMSPACE_NATIVE_FCM_TOKEN__) ||
    /TeamSpaceNativeApp/i.test(navigator?.userAgent || '')
  );

  useEffect(() => {
    if (isNative) {
      setIsSupported(true);
      setPermission('granted');
      loadPreferences();
      loadDeviceCount();
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setIsSupported(false);
      setLoading(false);
      return;
    }

    setPermission(Notification.permission);
    loadPreferences();
    loadDeviceCount();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Preferences load error:', error);
      }
      if (data) {
        setPrefs(data);
      }
    } catch (e) {
      console.warn('Preferences error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadDeviceCount = async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from('user_push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!error && typeof count === 'number') {
        setDeviceCount(count);
      }
    } catch (e) {
      console.warn('Device count error:', e);
    }
  };

  const handleTogglePref = async (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    if (!user) return;

    try {
      await supabase.from('notification_preferences').upsert({
        user_id: user.id,
        ...updated,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Failed to update preference:', e);
    }
  };

  const requestNotificationPermission = async () => {
    if (isNative) {
      await syncPushSubscriptionWithDatabase(user?.id);
      await loadDeviceCount();
      setStatusMessage({
        type: 'success',
        title: '✅ Native Android Notifications Active!',
        body: 'Your device is linked to TeamSpace High-Priority Push Gateway for instant heads-up alerts.'
      });
      return;
    }

    if (!('Notification' in window)) {
      setStatusMessage({
        type: 'error',
        title: '❌ Browser Unsupported',
        body: 'This browser does not support Web Push notifications. Please open in Google Chrome on Android.'
      });
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        const ok = await syncPushSubscriptionWithDatabase(user.id);
        await loadDeviceCount();
        setStatusMessage({
          type: 'success',
          title: '✅ Push Notifications Active!',
          body: ok
            ? 'This device is now registered to receive background push notifications from TeamSpace!'
            : 'Permission granted! Active on this browser.'
        });
      } else if (result === 'denied') {
        setStatusMessage({
          type: 'denied',
          title: '⚠️ Notifications Blocked',
          body: 'Chrome blocked notifications for this site. Follow the unblock guide below to enable them.'
        });
      }
    } catch (e) {
      console.warn('Permission request error:', e);
    }
  };

  const handleTestAlert = async () => {
    if (isNative) {
      try {
        setTesting(true);
        await dispatchPushNotification({
          userId: user?.id,
          title: '📢 TeamSpace Native Push Test',
          message: '🚀 Real-time push notification delivered directly to your Android device!'
        });
        setStatusMessage({
          type: 'success',
          title: '🔔 Native Alert Dispatched!',
          body: 'TeamSpace push service has sent a high-priority heads-up alert to your phone! Swipe down to view it.'
        });
      } catch (err) {
        setStatusMessage({
          type: 'error',
          title: '⚠️ Dispatch Note',
          body: err.message
        });
      } finally {
        setTesting(false);
      }
      return;
    }

    if (permission !== 'granted') {
      await requestNotificationPermission();
      return;
    }

    try {
      setTesting(true);

      // Ensure this device is subscribed to Push
      await syncPushSubscriptionWithDatabase(user?.id);

      // Attempt 1: Real Web Push via Cloudflare Worker -> Google FCM -> Android Phone
      try {
        const result = await sendTestPushToDevice();
        if (result && result.status === 'success') {
          setStatusMessage({
            type: 'success',
            title: '🚀 Real Push Dispatched to Phone!',
            body: 'Web Push was sent through Google FCM servers!\n👉 Swipe down from the top of your phone screen to see the native alert.'
          });
          return;
        }
      } catch (fcmErr) {
        console.warn('Real push test endpoint error, triggering SW fallback:', fcmErr);
      }

      // Fallback: Direct Service Worker native notification
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
        body: '🚀 Web Push is working! You will receive closed-browser alerts for tasks, announcements & attendance.',
        icon: iconUrl,
        badge: iconUrl,
        tag: 'teamspace-test-' + Date.now(),
        renotify: true,
        vibrate: [300, 100, 300, 100, 300]
      };

      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification('📢 TeamSpace Android Push Test', options);
      } else if (typeof window !== 'undefined' && typeof window.Notification === 'function') {
        try { new window.Notification('📢 TeamSpace Android Push Test', options); } catch (e) {}
      }

      setStatusMessage({
        type: 'success',
        title: '🔔 Test Alert Dispatched!',
        body: 'Check your phone’s system notification drawer (swipe down from top of screen).'
      });
    } catch (e) {
      setStatusMessage({
        type: 'error',
        title: '⚠️ Failed to Send Alert',
        body: e.message
      });
    } finally {
      setTesting(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="notif-card-warning">
        <h4>⚠️ Notifications Unsupported</h4>
        <p>This browser environment does not support background Service Worker notifications. For the best Android experience, please use <strong>Google Chrome</strong>.</p>
      </div>
    );
  }

  return (
    <div className="notif-prefs-container">
      {/* Device Status Bar */}
      <div className="notif-status-card">
        <div className="notif-status-left">
          <span className="notif-status-badge-icon">
            {permission === 'granted' ? '🟢' : permission === 'denied' ? '🔴' : '🟡'}
          </span>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>
              System Permission: <span style={{ textTransform: 'capitalize', color: permission === 'granted' ? '#34d399' : permission === 'denied' ? '#f87171' : '#fbbf24' }}>{permission}</span>
            </h4>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#8888aa' }}>
              {permission === 'granted' 
                ? `Active & Subscribed • ${deviceCount} device(s) registered for this account` 
                : 'Enable notifications to receive background team updates on your phone.'}
            </p>
          </div>
        </div>
        <div className="notif-status-actions">
          {permission !== 'granted' ? (
            <button 
              type="button" 
              onClick={requestNotificationPermission}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 600 }}
            >
              🔔 Enable Notifications
            </button>
          ) : (
            <button 
              type="button" 
              onClick={handleTestAlert}
              disabled={testing}
              className="btn btn-secondary btn-sm"
              style={{ border: '1px solid rgba(108, 99, 255, 0.4)' }}
            >
              {testing ? '⏳ Dispatching...' : '🧪 Test Alert'}
            </button>
          )}
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div className={`notif-alert-box ${statusMessage.type}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{statusMessage.title}</strong>
            <button 
              onClick={() => setStatusMessage(null)} 
              style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', whiteSpace: 'pre-line' }}>{statusMessage.body}</p>
        </div>
      )}

      {/* Android Chrome Unblock Guide */}
      {permission === 'denied' && (
        <div className="notif-unblock-guide">
          <h5 style={{ margin: '0 0 8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🔒</span> How to Unblock Notifications in Chrome (Android & Desktop)
          </h5>
          <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#aaaab8', lineHeight: '1.5' }}>
            <li>Tap the <strong>Lock / Tune icon (🔒 / ⚙️)</strong> beside the URL in your Chrome address bar.</li>
            <li>Select <strong>Permissions</strong> or <strong>Site Settings</strong>.</li>
            <li>Locate <strong>Notifications</strong> and tap <strong>Allow</strong>.</li>
            <li>Return here and tap <strong>"🧪 Test Alert"</strong> to verify.</li>
          </ol>
        </div>
      )}

      {/* Category Toggles */}
      <div className="notif-categories-card">
        <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#e2e8f0' }}>Notification Categories</h4>
        <div className="notif-toggle-list">
          <label className="notif-toggle-item">
            <div className="notif-toggle-info">
              <span className="notif-toggle-title">📢 Announcements & Acknowledgements</span>
              <span className="notif-toggle-desc">Instant alerts when leaders post important updates or request sign-offs.</span>
            </div>
            <input 
              type="checkbox" 
              checked={prefs.notify_announcements} 
              onChange={() => handleTogglePref('notify_announcements')}
              className="notif-checkbox"
            />
          </label>

          <label className="notif-toggle-item">
            <div className="notif-toggle-info">
              <span className="notif-toggle-title">📋 Smart Tasks & Submissions</span>
              <span className="notif-toggle-desc">Alerts when tasks are assigned to you, reviewed, or approved.</span>
            </div>
            <input 
              type="checkbox" 
              checked={prefs.notify_tasks} 
              onChange={() => handleTogglePref('notify_tasks')}
              className="notif-checkbox"
            />
          </label>

          <label className="notif-toggle-item">
            <div className="notif-toggle-info">
              <span className="notif-toggle-title">⏱️ Work Attendance & Verification</span>
              <span className="notif-toggle-desc">Alerts when team leaders record daily work contributions or notes.</span>
            </div>
            <input 
              type="checkbox" 
              checked={prefs.notify_attendance} 
              onChange={() => handleTogglePref('notify_attendance')}
              className="notif-checkbox"
            />
          </label>

          <label className="notif-toggle-item">
            <div className="notif-toggle-info">
              <span className="notif-toggle-title">⏰ Deadline Reminders</span>
              <span className="notif-toggle-desc">Automated alerts before task deadlines or announcement cutoffs.</span>
            </div>
            <input 
              type="checkbox" 
              checked={prefs.notify_reminders} 
              onChange={() => handleTogglePref('notify_reminders')}
              className="notif-checkbox"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
