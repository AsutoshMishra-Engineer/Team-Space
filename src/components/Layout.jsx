import React, { useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NetworkStatus from './NetworkStatus';
import { syncPushSubscriptionWithDatabase } from '../lib/pushService';

export const Layout = ({ children }) => {
  const { user, profile, signOut } = useAuth();

  // Automatically keep mobile push token synced in background whenever user is authenticated
  useEffect(() => {
    if (user?.id && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      syncPushSubscriptionWithDatabase(user.id);
    }
  }, [user?.id]);

  const initials = profile?.username
    ? profile.username.slice(0, 2).toUpperCase()
    : profile?.email
    ? profile.email.slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className="app-layout">
      {/* Network status bar — always at top */}
      <NetworkStatus />

      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          <img src="/logo.png" alt="TeamSpace Logo" className="brand-logo-img" />
          <span>TeamSpace</span>
        </Link>
        <div className="navbar-links">
          {user ? (
            <div className="navbar-user">
              <div className="navbar-user-id">ID: {profile?.user_id}</div>
              <Link to="/workspace" className="btn btn-ghost btn-small">Dashboard</Link>
              <Link to="/workspace/ai" className="btn btn-ghost btn-small" title="Groq AI Work Studio">⚡ AI Studio</Link>
              <div className="navbar-avatar" title={profile?.username || 'Profile'}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="nav-avatar-img" />
                ) : (
                  <div className="nav-avatar-initials">{initials}</div>
                )}
              </div>
              <button onClick={signOut} className="btn btn-ghost btn-small">Sign Out</button>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-small">Login</Link>
              <Link to="/register" className="btn btn-primary btn-small">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      <main className="main-content">
        {children || <Outlet />}
      </main>

      <footer className="global-app-footer">
        <div className="global-app-footer-content">
          <span className="security-tag-badge">🛡️ [F-204 IT CELL PROTECTED]</span>
        </div>
      </footer>
    </div>
  );
};
