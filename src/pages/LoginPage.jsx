import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [userIdInput, setUserIdInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginMode, setLoginMode] = useState('userid'); // 'userid' or 'email'
  const [showUserId, setShowUserId] = useState(''); // show User ID after email login
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotResult, setForgotResult] = useState('');

  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile && !loading && !showUserId) {
      navigate('/workspace');
    }
  }, [user, profile, loading, navigate, showUserId]);

  const handleLoginWithUserId = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const normalizedUserId = userIdInput.trim().toUpperCase();

      // Use RPC function (works without authentication)
      const { data: email, error: rpcError } = await supabase
        .rpc('get_email_by_user_id', { p_user_id: normalizedUserId });

      if (rpcError || !email) {
        setError('No account found with this User ID.');
        setIsSubmitting(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password
      });

      if (signInError) {
        setError('Invalid password. Please try again.');
      } else {
        navigate('/workspace');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginWithEmail = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password
      });

      if (signInError) {
        setError('Invalid email or password. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Fetch profile to show User ID
      if (data?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', data.user.id)
          .single();

        if (profileData?.user_id) {
          setShowUserId(profileData.user_id);
        } else {
          navigate('/workspace');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setForgotResult('');
    setIsSubmitting(true);

    try {
      // Use RPC function (works without authentication)
      const { data: foundUserId, error: rpcError } = await supabase
        .rpc('get_user_id_by_email', { p_email: forgotEmail.trim() });

      if (rpcError || !foundUserId) {
        setError('No account found with this email.');
      } else {
        setForgotResult(foundUserId);
      }
    } catch (err) {
      setError('An error occurred while looking up your account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show User ID after first email login
  if (showUserId) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2 className="auth-title text-success">✅ Login Successful!</h2>

          <div className="user-id-display">
            <div className="user-id-label">Your User ID is:</div>
            <div className="user-id-value">{showUserId}</div>
          </div>

          <div className="alert alert-warning mb-3">
            ⚠️ SAVE THIS ID! Next time, use this ID + your password to log in.
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={() => navigate('/workspace')}
          >
            Go to Workspace →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {!showForgot ? (
          <>
            <h2 className="auth-title">Welcome Back</h2>

            {/* Login Mode Toggle */}
            <div className="flex gap-1 mb-2" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className={`btn btn-small ${loginMode === 'userid' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setLoginMode('userid'); setError(''); }}
              >
                Login with User ID
              </button>
              <button
                type="button"
                className={`btn btn-small ${loginMode === 'email' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setLoginMode('email'); setError(''); }}
              >
                Login with Email
              </button>
            </div>

            <p className="auth-subtitle">
              {loginMode === 'userid'
                ? 'Enter your User ID and password'
                : '🆕 First time? Use your email to find your User ID'}
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            {loginMode === 'userid' ? (
              <form onSubmit={handleLoginWithUserId}>
                <div className="form-group">
                  <label className="form-label" htmlFor="userId">User ID</label>
                  <input
                    id="userId"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 304TX58"
                    value={userIdInput}
                    onChange={(e) => setUserIdInput(e.target.value)}
                    required
                    style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginWithEmail}>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="passwordEmail">Password</label>
                  <input
                    id="passwordEmail"
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Sign In & Show My User ID'}
                </button>
              </form>
            )}

            <div className="auth-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ border: 'none', padding: 0, fontSize: '0.9rem', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                onClick={() => { setShowForgot(true); setError(''); }}
              >
                Forgot User ID?
              </button>
              <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                Don't have an account? <Link to="/register">Register</Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="auth-title">Forgot User ID</h2>
            <p className="auth-subtitle">Enter your email to find your User ID</p>

            {error && <div className="alert alert-error">{error}</div>}

            {forgotResult ? (
              <div className="user-id-display">
                <div className="user-id-label">Your User ID is:</div>
                <div className="user-id-value">{forgotResult}</div>
                <button
                  className="btn btn-primary mt-2"
                  onClick={() => {
                    setUserIdInput(forgotResult);
                    setLoginMode('userid');
                    setShowForgot(false);
                    setForgotResult('');
                  }}
                >
                  Use this ID to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgotEmail">Email</label>
                  <input
                    id="forgotEmail"
                    type="email"
                    className="form-input"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Searching...' : 'Find My User ID'}
                </button>
              </form>
            )}

            <div className="auth-footer" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ border: 'none', padding: 0, fontSize: '0.9rem', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                onClick={() => { setShowForgot(false); setError(''); setForgotResult(''); }}
              >
                ← Back to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
