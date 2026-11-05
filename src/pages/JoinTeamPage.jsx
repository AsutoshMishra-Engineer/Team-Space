import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function JoinTeamPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    try {
      setSubmitting(true);
      setError('');

      // Single secure function call that handles everything
      const { data: result, error: rpcError } = await supabase
        .rpc('join_team_by_code', { p_team_code: code.trim().toUpperCase() });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (result?.success) {
        navigate(`/workspace/team/${result.team_id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <Link to="/workspace" className="back-link">← Back to My Teams</Link>
      <div className="auth-card">
        <h2 className="auth-title">Join a Team</h2>
        <p className="auth-subtitle">Enter the Team Code shared by your team leader</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Team Code</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 582QK"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              style={{ textTransform: 'uppercase', letterSpacing: '4px', fontWeight: 600, fontSize: '1.2rem', textAlign: 'center' }}
            />
            <div className="form-hint">Your leader must have invited your User ID first</div>
          </div>

          <button
            type="submit"
            disabled={submitting || !code.trim()}
            className="btn btn-primary btn-full"
          >
            {submitting ? 'Joining...' : 'Join Team'}
          </button>
        </form>
      </div>
    </div>
  );
}
