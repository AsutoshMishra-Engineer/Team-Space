import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ManageMembers({ teamId, members, onClose, onMembersChange }) {
  const [inviteId, setInviteId] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingRoleValue, setEditingRoleValue] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const getLocalRoles = () => {
    try {
      return JSON.parse(localStorage.getItem(`team_member_roles_${teamId}`) || '{}');
    } catch (e) {
      return {};
    }
  };
  const localRoles = getLocalRoles();

  const handleSaveRole = async (targetUserId, roleText) => {
    try {
      setSavingRole(true);
      const cleanRole = roleText.trim();

      // 1. Save in localStorage for instant offline/session reflection
      const currentLocal = getLocalRoles();
      currentLocal[targetUserId] = cleanRole;
      localStorage.setItem(`team_member_roles_${teamId}`, JSON.stringify(currentLocal));

      // 2. Save in database via RPC
      try {
        const { error: rpcErr } = await supabase.rpc('set_member_role', {
          p_team_id: teamId,
          p_user_id: targetUserId,
          p_role_title: cleanRole
        });

        if (rpcErr) {
          await supabase
            .from('team_members')
            .update({ member_role: cleanRole })
            .eq('team_id', teamId)
            .eq('user_id', targetUserId);
        }
      } catch (e) {
        console.warn('Database role save note:', e);
      }

      setEditingUserId(null);
      setEditingRoleValue('');
      setSuccess(`✅ Role saved as "${cleanRole || 'Member'}"!`);
      setTimeout(() => setSuccess(''), 3000);
      onMembersChange();
    } catch (err) {
      alert('Failed to save role: ' + err.message);
    } finally {
      setSavingRole(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    const cleanId = inviteId.trim().toUpperCase();
    if (!cleanId) return;

    try {
      setInviting(true);
      setError('');
      setSuccess('');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_id', cleanId)
        .single();

      if (profileError || !profile) {
        setError(`No account found with User ID "${cleanId}". Double check the ID.`);
        return;
      }

      const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existing) {
        setError(`User ${cleanId} is already on this team or has a pending invite.`);
        return;
      }

      const roleTitle = inviteRole.trim();
      const { error: insertError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: profile.id,
          role: 'member',
          status: 'pending',
          member_role: roleTitle || null
        });

      if (insertError) {
        // Fallback without member_role column if DB column not added yet
        await supabase
          .from('team_members')
          .insert({ team_id: teamId, user_id: profile.id, role: 'member', status: 'pending' });
      }

      if (roleTitle) {
        const currentLocal = getLocalRoles();
        currentLocal[profile.id] = roleTitle;
        localStorage.setItem(`team_member_roles_${teamId}`, JSON.stringify(currentLocal));
      }

      setSuccess(`✅ Successfully invited User ID "${cleanId}"${roleTitle ? ` with role "${roleTitle}"` : ''}!`);
      setInviteId('');
      setInviteRole('');
      onMembersChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberUserId, memberDisplayId) => {
    if (!window.confirm(`Are you sure you want to remove member ${memberDisplayId} from the team?`)) return;
    try {
      setRemovingId(memberUserId);
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', memberUserId);

      if (error) throw error;
      onMembersChange();
    } catch (err) {
      alert('Failed to remove: ' + err.message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="pro-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pro-manage-modal">
        {/* Header */}
        <div className="pro-manage-topbar">
          <div className="pro-manage-title-box">
            <span className="pro-manage-icon">👥</span>
            <div>
              <h3>Team Members & Roles</h3>
              <p>Add teammates by their User ID, assign specific roles, and manage team permissions.</p>
            </div>
          </div>
          <button className="pro-settings-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="pro-manage-body">
          {/* Quick Invite Card */}
          <div className="pro-invite-card">
            <div className="pro-invite-header">
              <span className="pro-invite-badge">ADD NEW TEAMMATE</span>
              <h4>Invite by User ID & Assign Role</h4>
              <p>Enter teammate's User ID and specify their role in the project.</p>
            </div>

            <form onSubmit={handleInvite} className="pro-invite-form" style={{ flexWrap: 'wrap', gap: '0.65rem' }}>
              <div className="pro-invite-input-wrap" style={{ flex: '1 1 140px' }}>
                <span className="pro-input-prefix">ID:</span>
                <input
                  type="text"
                  className="pro-invite-input"
                  placeholder="e.g. 276ZV9"
                  value={inviteId}
                  onChange={(e) => setInviteId(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="pro-invite-input-wrap" style={{ flex: '2 1 200px' }}>
                <span className="pro-input-prefix">Role:</span>
                <input
                  type="text"
                  className="pro-invite-input"
                  placeholder="e.g. Frontend Developer, Designer..."
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={inviting || !inviteId.trim()}
                className="pro-btn-invite"
                style={{ flexShrink: 0 }}
              >
                {inviting ? 'Inviting...' : 'Send Invitation ✉️'}
              </button>
            </form>

            {error && <div className="alert alert-error mt-2">{error}</div>}
            {success && <div className="alert alert-success mt-2">{success}</div>}
          </div>

          {/* Members List */}
          <div className="pro-roster-section">
            <div className="pro-roster-header">
              <h4>Current Team Members ({members.length})</h4>
              <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                Leader can assign and edit custom roles for any teammate
              </span>
            </div>

            <div className="pro-members-table">
              {members.map((m) => {
                const isLead = m.role === 'leader';
                const isPending = m.status === 'pending';
                const displayId = m.profiles?.user_id || 'Unknown ID';
                const currentRole = m.member_role || localRoles[m.user_id] || (isPending ? 'Pending' : isLead ? 'Team Leader' : 'Member');

                return (
                  <div key={m.id} className="pro-member-row">
                    <div className="pro-member-avatar-box">
                      <span className="pro-avatar-symbol">
                        {isLead ? '👑' : isPending ? '⏳' : '👤'}
                      </span>
                    </div>

                    <div className="pro-member-info">
                      <div className="pro-member-id-row" style={{ flexWrap: 'wrap', gap: '6px' }}>
                        <span className="pro-member-user-id">{displayId}</span>
                        <span
                          className={`pro-badge-role ${
                            isLead ? 'badge-leader' : isPending ? 'badge-pending' : 'badge-member'
                          }`}
                        >
                          {currentRole}
                        </span>
                      </div>

                      {/* Inline Edit Role Form */}
                      {editingUserId === m.user_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter role (e.g. Frontend Developer, Designer)"
                            value={editingRoleValue}
                            onChange={(e) => setEditingRoleValue(e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '0.8rem', maxWidth: '220px' }}
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={savingRole}
                            onClick={() => handleSaveRole(m.user_id, editingRoleValue)}
                            className="btn btn-primary btn-small"
                            style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                          >
                            {savingRole ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUserId(null)}
                            className="btn btn-ghost btn-small"
                            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="pro-member-meta">
                          {isLead ? 'Team Creator & Workspace Leader' : 'Joined via team invitation'}
                        </div>
                      )}
                    </div>

                    <div className="pro-member-action" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUserId(editingUserId === m.user_id ? null : m.user_id);
                          setEditingRoleValue(currentRole === 'Member' ? '' : currentRole);
                        }}
                        className="btn btn-secondary btn-small"
                        style={{
                          padding: '4px 9px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          background: 'rgba(108, 99, 255, 0.12)',
                          color: 'var(--accent)',
                          border: '1px solid rgba(108, 99, 255, 0.25)'
                        }}
                        title="Set or update member role"
                      >
                        ✏️ Edit Role
                      </button>

                      {!isLead ? (
                        <button
                          onClick={() => handleRemove(m.user_id, displayId)}
                          disabled={removingId === m.user_id}
                          className="pro-btn-member-remove"
                          title="Remove from team"
                        >
                          {removingId === m.user_id ? 'Removing...' : 'Remove'}
                        </button>
                      ) : (
                        <span className="pro-leader-protect-tag">Owner</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pro-manage-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
