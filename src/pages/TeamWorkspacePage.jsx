import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import TeamInfoBar from '../components/TeamInfoBar';
import Announcements from '../components/Announcements';
import TeamChat from '../components/TeamChat';
import SharedFiles from '../components/SharedFiles';
import LeaveTeam from '../components/LeaveTeam';
import SmartTasks from '../components/SmartTasks';
import WorkAttendance from '../components/WorkAttendance';
import { PageLoader } from '../components/Spinner';

export default function TeamWorkspacePage() {
  const { teamId } = useParams();
  const { user, profile } = useAuth();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLeader, setIsLeader] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'tasks' | 'attendance' | 'files'

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError('');

      // Single secure function call — bypasses all RLS issues
      const { data: result, error: rpcError } = await supabase
        .rpc('get_team_data', { p_team_id: teamId });

      if (rpcError) throw rpcError;

      if (result?.error) {
        setError(result.error);
        setIsMember(false);
        return;
      }

      setTeam(result.team);
      setMembers(result.members || []);
      setIsMember(true);

      const currentUserMember = (result.members || []).find(m => m.user_id === user.id);
      if (currentUserMember) {
        setIsLeader(currentUserMember.role === 'leader');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && teamId) {
      fetchTeamData();
    }
  }, [user, teamId]);

  if (loading) return <PageLoader text="Loading team workspace..." />;
  if (error) return <div className="error-message">Error: {error}</div>;
  if (!isMember) return <div className="error-message">Access Denied. You are not an active member of this team.</div>;

  return (
    <div className="workspace-container">
      <Link to="/workspace" className="back-link">← Back to My Teams</Link>

      {/* Personal quote — only YOU see this, teammates never see it */}
      {profile?.personal_quote && (
        <div className="personal-quote">
          <span className="quote-icon">💭</span>
          <em>"{profile.personal_quote}"</em>
        </div>
      )}

      <TeamInfoBar 
        team={team} 
        members={members} 
        isLeader={isLeader} 
        currentUser={user}
        onMembersChange={fetchTeamData}
      />

      {/* Workspace Hub Navigation Tabs */}
      <div className="workspace-nav-bar">
        <button
          type="button"
          className={`workspace-nav-tab ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          📢 Announcements & Chat
        </button>

        <button
          type="button"
          className={`workspace-nav-tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          📋 Smart Tasks
        </button>

        <button
          type="button"
          className={`workspace-nav-tab ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          ⏱️ Work Attendance
        </button>

        <button
          type="button"
          className={`workspace-nav-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          📁 Shared Drive
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'feed' && (
        <div className="workspace-sections">
          <div className="left-column">
            <Announcements teamId={teamId} isLeader={isLeader} members={members} />
          </div>
          <div className="right-column">
            <TeamChat teamId={teamId} isLeader={isLeader} />
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <SmartTasks teamId={teamId} isLeader={isLeader} members={members} />
      )}

      {activeTab === 'attendance' && (
        <WorkAttendance teamId={teamId} isLeader={isLeader} members={members} />
      )}

      {activeTab === 'files' && (
        <SharedFiles teamId={teamId} isLeader={isLeader} />
      )}

      <LeaveTeam teamId={teamId} isLeader={isLeader} members={members} />
    </div>
  );
}
