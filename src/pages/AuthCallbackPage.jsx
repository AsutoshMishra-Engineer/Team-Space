import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Try to get code from multiple places (HashRouter compatibility)
        const fullUrl = window.location.href;
        const mainParams = new URLSearchParams(window.location.search);
        const hashParts = window.location.hash.split('?');
        const hashParams = hashParts.length > 1 ? new URLSearchParams(hashParts[1]) : new URLSearchParams();

        const code = mainParams.get('code') || hashParams.get('code');

        if (code) {
          // Exchange code for session (PKCE flow)
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) {
            setError(sessionError.message);
            setLoading(false);
            return;
          }
        }

        // Check if we already have a session (auto-detected or just exchanged)
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const metaName = session.user.user_metadata?.username || session.user.user_metadata?.full_name;

          // Fetch profile with retries (trigger may take a moment)
          let retries = 5;
          let profileId = null;

          while (retries > 0 && !profileId) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_id, username')
              .eq('id', session.user.id)
              .single();

            if (profile?.user_id) {
              profileId = profile.user_id;
              // If profile exists but username was not saved, update it from metadata
              if (!profile.username && metaName) {
                await supabase
                  .from('profiles')
                  .update({ username: metaName.trim() })
                  .eq('id', session.user.id);
              }
              break;
            }

            await new Promise(res => setTimeout(res, 2000));
            retries--;
          }

          if (profileId) {
            setUserId(profileId);
          } else {
            setError('Your account is verified but User ID is still generating. Please go to Login and use "Login with Email" to see your User ID.');
          }
        } else {
          setError('No active session found. Your email may already be verified. Please go to Login and use "Login with Email" to see your User ID.');
        }
      } catch (err) {
        console.error('Callback error:', err);
        setError('An error occurred. Please go to Login and use "Login with Email" to see your User ID.');
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, []);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
        <p className="text-muted mt-2">Verifying your email...</p>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {error ? (
          <>
            <h2 className="auth-title">Verification Status</h2>
            <div className="alert alert-info">{error}</div>
            <div className="flex gap-2 mt-2" style={{ flexDirection: 'column' }}>
              <Link to="/login" className="btn btn-primary btn-full">Go to Login</Link>
              <Link to="/register" className="btn btn-secondary btn-full">Back to Register</Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="auth-title text-success">✅ Email Verified!</h2>

            <div className="user-id-display">
              <div className="user-id-label">Your permanent User ID:</div>
              <div className="user-id-value">{userId}</div>
            </div>

            <div className="alert alert-warning mb-3">
              ⚠️ SAVE THIS ID! You need it to log in. Write it down or take a screenshot.
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={() => navigate('/workspace')}
            >
              Go to Workspace →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
