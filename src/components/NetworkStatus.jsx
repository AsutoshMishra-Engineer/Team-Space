import React, { useState, useEffect } from 'react';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBack(true);
      // Hide the "back online" banner after 3 seconds
      setTimeout(() => setShowBack(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowBack(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showBack) return null;

  return (
    <div className={`network-bar ${isOnline ? 'network-bar-online' : 'network-bar-offline'}`}>
      {isOnline ? (
        <>
          <span className="network-dot network-dot-green" />
          ✅ Back online! Page will refresh shortly...
        </>
      ) : (
        <>
          <span className="network-dot network-dot-red" />
          ⚠️ No internet connection. Waiting to reconnect...
          <span className="network-spinner" />
        </>
      )}
    </div>
  );
}
