import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) navigate('/workspace');
  }, [user, loading, navigate]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Register directly with Supabase Auth (User ID is automatically assigned)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/#/auth/callback',
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('An account with this email already exists. Please log in.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (data.user?.identities?.length === 0) {
        setError('An account with this email already exists. Please log in.');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-success-icon">✅</div>
          <h2 className="auth-title">Almost Done!</h2>
          <div className="alert alert-success mb-2">
            Verification email sent to <strong>{email}</strong>
          </div>
          <div className="alert alert-info mb-3">
            <strong>Next steps:</strong><br />
            1. Check your inbox → Click the verification link<br />
            2. Come back here → Click Login with Email<br />
            3. Your unique <strong>User ID</strong> will be ready automatically!
          </div>
          <Link to="/login" className="btn btn-primary btn-full">Go to Login →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header-brand" style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <img src="/logo.png" alt="TeamSpace" style={{ width: '48px', height: '48px', margin: '0 auto 0.5rem', borderRadius: '12px' }} />
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Fast & Simple Sign Up — Your User ID is automatically generated</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="form-hint">Must be at least 8 characters</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary btn-full"
            style={{ padding: '12px', fontSize: '0.95rem', marginTop: '0.5rem' }}
          >
            {isSubmitting ? 'Creating Account...' : '🚀 Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
