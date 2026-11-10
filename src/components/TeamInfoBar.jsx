import React, { useState } from 'react';
import ManageMembers from './ManageMembers';

export default function TeamInfoBar({ team, members, isLeader, currentUser, onMembersChange }) {
  const [showManage, setShowManage] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(team.team_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingMembers = members.filter(m => m.status === 'pending');

  const getLocalRoles = () => {
    try {
      return JSON.parse(localStorage.getItem(`team_member_roles_${team.id}`) || '{}');
    } catch (e) {
      return {};
    }
  };
  const localRoles = getLocalRoles();

  return (
    <div className="pro-team-banner">
      <div className="pro-banner-top">
        <div className="pro-banner-identity">
          <div className="pro-team-avatar">🏢</div>
          <div>
            <h1 className="pro-team-name">{team.name}</h1>
            {team.project_idea && <p className="pro-team-idea">{team.project_idea}</p>}
          </div>
        </div>

        {/* Team Code pill */}
        <div className="pro-code-pill-box">
          <div className="pro-code-info">
            <span className="pro-code-label">TEAM ACCESS CODE</span>
            <span className="pro-code-value">{team.team_code}</span>
          </div>
          <button onClick={handleCopy} className="pro-code-copy-btn" title="Copy Team Code">
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>

      {/* Members Bar */}
      <div className="pro-members-strip">
        <div className="pro-strip-left">
          <div className="pro-strip-counts">
            <span className="pro-strip-badge">👥 {activeMembers.length} Members</span>
            {pendingMembers.length > 0 && (
              <span className="pro-strip-badge pro-badge-amber">{pendingMembers.length} Pending</span>
            )}
          </div>

          <div className="pro-roster-chips">
            {members.map((m) => {
              const isLead = m.role === 'leader';
              const isPend = m.status === 'pending';
              const userId = m.profiles?.user_id || 'ID: ????';
              const displayName = m.profiles?.username?.trim() || userId;
              const assignedRole = m.member_role || localRoles[m.user_id] || (isPend ? 'Pending' : isLead ? 'Leader' : 'Member');

              return (
                <div
                  key={m.id}
                  className={`pro-roster-chip ${isLead ? 'chip-leader' : isPend ? 'chip-pending' : ''}`}
                  title={`${displayName} • ID: ${userId} (${assignedRole})`}
                >
                  <span className="pro-chip-avatar">
                    {isLead ? '👑' : isPend ? '⏳' : '👤'}
                  </span>
                  <span className="pro-chip-id">{displayName}</span>
                  <span className="pro-chip-role">
                    {assignedRole}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {isLeader && (
          <button
            onClick={() => setShowManage(true)}
            className="pro-btn-manage-members"
          >
            ⚙️ Manage Members
          </button>
        )}
      </div>

      {/* Manage Members Modal */}
      {showManage && (
        <ManageMembers
          teamId={team.id}
          members={members}
          onClose={() => setShowManage(false)}
          onMembersChange={onMembersChange}
        />
      )}
    </div>
  );
}
