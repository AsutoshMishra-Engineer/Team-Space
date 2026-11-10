// Android WebView & Browser Notification Safe Polyfill (CSP-safe external module)
if (typeof window !== 'undefined' && !('Notification' in window)) {
  const DummyNotification = function (title, options) {
    return {};
  };
  DummyNotification.permission = 'granted';
  DummyNotification.requestPermission = async () => 'granted';
  window.Notification = DummyNotification;
}
