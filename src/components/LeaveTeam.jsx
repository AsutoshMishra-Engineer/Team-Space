import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function LeaveTeam({ teamId, isLeader, members }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newLeaderId, setNewLeaderId] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleLeaveAsMember = async () => {
    if (!window.confirm('Are you sure you want to leave this team?')) return;
    try {
      setProcessing(true);
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', user.id);

      if (error) throw error;
      navigate('/workspace');
    } catch (err) {
      alert(`Error leaving team: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleTransferLeadership = async () => {
    if (!newLeaderId) {
      alert('Please select a team member to become the new leader.');
      return;
    }
    if (!window.confirm('Are you sure you want to transfer leadership to this member?')) return;
    try {
      setProcessing(true);
      const { error: updateNewLeader } = await supabase
        .from('team_members')
        .update({ role: 'leader' })
        .eq('team_id', teamId)
        .eq('user_id', newLeaderId);

      if (updateNewLeader) throw updateNewLeader;

      const { error: updateSelf } = await supabase
        .from('team_members')
        .update({ role: 'member' })
        .eq('team_id', teamId)
        .eq('user_id', user.id);

      if (updateSelf) throw updateSelf;

      navigate('/workspace');
    } catch (err) {
      alert(`Error transferring leadership: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteTeam = async () => {
    const confirmation = window.confirm(
      '🚨 CRITICAL ACTION:\nAre you sure you want to DELETE this entire team workspace?\n\nAll shared files, real-time chats, announcements, and member access will be permanently deleted. This cannot be undone.'
    );
    if (!confirmation) return;

    try {
      setProcessing(true);
      // Delete storage files first
      const { data: storageFiles } = await supabase.storage.from('team-files').list(teamId);
      if (storageFiles && storageFiles.length > 0) {
        const paths = storageFiles.map(f => `${teamId}/${f.name}`);
        await supabase.storage.from('team-files').remove(paths);
      }

      // Delete team (CASCADE handles members, announcements, chat, file records)
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;
      navigate('/workspace');
    } catch (err) {
      alert(`Error deleting team: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const activeMembers = members.filter(
    (m) => m.user_id !== user.id && m.status === 'active'
  );

  return (
    <div className="pro-admin-governance">
      <div className="pro-admin-banner">
        <div className="pro-admin-badge-row">
          <span className="pro-admin-shield">🛡️</span>
          <span className="pro-admin-pill">
            {isLeader ? 'Leader Governance & Controls' : 'Membership Settings'}
          </span>
        </div>
        <h3 className="pro-admin-title">
          {isLeader ? 'Team Administration & Workspace Control' : 'Leave Workspace'}
        </h3>
        <p className="pro-admin-desc">
          {isLeader
            ? 'Manage workspace delegation, reassign team leadership, or permanently dismantle this workspace.'
            : 'You are currently an active member of this team workspace. You can step down and leave at any time.'}
        </p>
      </div>

      {!isLeader ? (
        <div className="pro-admin-card-single">
          <div className="pro-admin-card-content">
            <h4>Leave Workspace</h4>
            <p>
              Remove yourself from this team. You will lose access to team chat, shared files, and announcements until re-invited.
            </p>
          </div>
          <button
            onClick={handleLeaveAsMember}
            disabled={processing}
            className="pro-btn-danger"
          >
            {processing ? 'Leaving...' : '🚪 Leave Workspace'}
          </button>
        </div>
      ) : (
        <div className="pro-admin-grid">
          {/* Transfer Leadership Card */}
          <div className="pro-admin-box">
            <div className="pro-admin-box-header">
              <span className="pro-box-icon">👑</span>
              <div>
                <h4>Transfer Workspace Leadership</h4>
                <p>Appoint an active teammate as the new team leader.</p>
              </div>
            </div>

            {activeMembers.length > 0 ? (
              <div className="pro-admin-box-body">
                <label className="pro-select-label">Select Successor Teammate:</label>
                <select
                  value={newLeaderId}
                  onChange={(e) => setNewLeaderId(e.target.value)}
                  className="pro-select-field"
                >
                  <option value="">Choose an active member...</option>
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.user_id}>
                      {m.profiles?.username || m.profiles?.user_id || 'Member'}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleTransferLeadership}
                  disabled={!newLeaderId || processing}
                  className="pro-btn-primary mt-2"
                >
                  {processing ? 'Transferring...' : 'Transfer Leadership & Demote to Member'}
                </button>
              </div>
            ) : (
              <div className="pro-admin-note">
                ℹ️ There are no other members in this team yet. Invite members to enable leadership delegation.
              </div>
            )}
          </div>

          {/* Delete Team Card */}
          <div className="pro-admin-box pro-admin-danger-box">
            <div className="pro-admin-box-header">
              <span className="pro-box-icon">🚨</span>
              <div>
                <h4>Permanent Workspace Deletion</h4>
                <p>Irreversibly delete this team, chat logs, files, and memberships.</p>
              </div>
            </div>

            <div className="pro-admin-box-body">
              <div className="pro-danger-notice">
                ⚠️ Once deleted, all team records and stored documents will be erased immediately.
              </div>
              <button
                onClick={handleDeleteTeam}
                disabled={processing}
                className="pro-btn-danger mt-2"
              >
                {processing ? 'Deleting Workspace...' : '🗑️ Delete Entire Team Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
