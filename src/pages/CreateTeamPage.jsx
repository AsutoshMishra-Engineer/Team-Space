import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function CreateTeamPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [projectIdea, setProjectIdea] = useState('');
  const [invites, setInvites] = useState(['']);
  const [inviteErrors, setInviteErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdTeam, setCreatedTeam] = useState(null);

  const handleAddInvite = () => setInvites([...invites, '']);
  const handleRemoveInvite = (index) => {
    const newInvites = [...invites];
    newInvites.splice(index, 1);
    setInvites(newInvites);
    const newErrors = { ...inviteErrors };
    delete newErrors[index];
    setInviteErrors(newErrors);
  };

  const handleInviteChange = (index, value) => {
    const newInvites = [...invites];
    newInvites[index] = value;
    setInvites(newInvites);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Team name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setInviteErrors({});

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ name: name.trim(), project_idea: projectIdea.trim() || null, created_by: user.id })
        .select()
        .single();

      if (teamError) throw teamError;

      const { error: leaderError } = await supabase
        .from('team_members')
        .insert({ team_id: team.id, user_id: user.id, role: 'leader', status: 'active' });

      if (leaderError) throw leaderError;

      const errors = {};
      for (let i = 0; i < invites.length; i++) {
        const inviteId = invites[i].trim().toUpperCase();
        if (!inviteId) continue;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, user_id')
          .eq('user_id', inviteId)
          .single();

        if (profileError || !profile) {
          errors[i] = 'No user found with this ID. Please check and try again.';
          continue;
        }

        if (profile.id === user.id) {
          errors[i] = 'You are already the leader of this team.';
          continue;
        }

        const { data: existing } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', team.id)
          .eq('user_id', profile.id)
          .maybeSingle();

        if (existing) {
          errors[i] = 'This user is already invited or already on this team.';
          continue;
        }

        await supabase
          .from('team_members')
          .insert({ team_id: team.id, user_id: profile.id, role: 'member', status: 'pending' });
      }

      if (Object.keys(errors).length > 0) {
        setInviteErrors(errors);
      }

      setCreatedTeam(team);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (createdTeam) {
    return (
      <div className="auth-container">
        <div className="success-card">
          <h2>✅ Team Created!</h2>
          <p className="text-muted mb-2">Share this code with your invited members:</p>
          <div className="team-code-display">
            <div className="team-code-value">{createdTeam.team_code}</div>
          </div>
          <div className="flex-center gap-2 mt-2">
            <button
              className="btn btn-secondary btn-small"
              onClick={() => {
                navigator.clipboard.writeText(createdTeam.team_code);
              }}
            >
              📋 Copy Code
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/workspace/team/${createdTeam.id}`)}
            >
              Go to Team Workspace →
            </button>
          </div>
          {Object.keys(inviteErrors).length > 0 && (
            <div className="alert alert-error mt-3">
              Some invites had issues. You can invite them later from the team workspace.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container" style={{ maxWidth: '560px' }}>
      <Link to="/workspace" className="back-link">← Back to My Teams</Link>
      <div className="auth-card">
        <h1 className="auth-title">Create a Team</h1>
        <p className="auth-subtitle">Set up your team workspace and invite members</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Team Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="My Awesome Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Project Idea (Optional)</label>
            <textarea
              className="form-input"
              placeholder="What's your team working on?"
              value={projectIdea}
              onChange={(e) => setProjectIdea(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Invite Members by User ID (Optional)</label>
            <div className="invite-fields">
              {invites.map((inv, index) => (
                <div key={index}>
                  <div className="invite-row">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 304TX58"
                      value={inv}
                      onChange={(e) => handleInviteChange(index, e.target.value)}
                    />
                    {invites.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveInvite(index)}
                        className="btn btn-danger btn-small"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {inviteErrors[index] && (
                    <div className="invite-error">{inviteErrors[index]}</div>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddInvite}
              className="btn btn-ghost btn-small mt-1"
            >
              + Add Another Member
            </button>
          </div>

          <button type="submit" disabled={submitting} className="btn btn-primary btn-full">
            {submitting ? 'Creating...' : 'Create Team'}
          </button>
        </form>
      </div>
    </div>
  );
}
