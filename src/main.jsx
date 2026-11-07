import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import './index.css'

// Android WebView & Browser Notification Safe Polyfill
if (typeof window !== 'undefined' && !('Notification' in window)) {
  const DummyNotification = function(title, options) {
    console.log('[Native App] Notification handled natively:', title, options);
    return {};
  };
  DummyNotification.permission = 'granted';
  DummyNotification.requestPermission = async () => 'granted';
  window.Notification = DummyNotification;
}

// Register Service Worker for Mobile & Desktop Chrome notifications
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('TeamSpace Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('Service Worker registration skipped:', err);
      });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
)
