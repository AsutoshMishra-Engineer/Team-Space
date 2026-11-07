import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { dispatchPushNotification } from '../lib/pushService';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present / Full Work', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', weight: 1.0 },
  { value: 'partial', label: 'Partial Contribution', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', weight: 0.5 },
  { value: 'absent', label: 'Absent / No Work', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', weight: 0.0 },
  { value: 'excused', label: 'Excused / Leave', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', weight: null }
];

export default function WorkAttendance({ teamId, teamName, isLeader, members = [] }) {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Form state for creating a session
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSessionTitle, setNewSessionTitle] = useState('Daily Standup & Milestone Sprint');

  // Working state for attendance marks in selected session: { [userId]: { status, notes } }
  const [sessionMarks, setSessionMarks] = useState({});
  const [initialMarks, setInitialMarks] = useState({});
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    if (teamId) {
      loadAttendanceData();
    }
  }, [teamId]);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      // Fetch summary via RPC
      const { data, error } = await supabase.rpc('get_team_attendance_summary', {
        p_team_id: teamId
      });

      if (error) {
        // Fallback direct queries
        const { data: sData } = await supabase
          .from('attendance_sessions')
          .select('*')
          .eq('team_id', teamId)
          .order('session_date', { ascending: false });

        const { data: rData } = await supabase
          .from('work_attendance')
          .select('*')
          .eq('team_id', teamId);

        setSessions(sData || []);
        setRecords(rData || []);

        if (sData && sData.length > 0 && !selectedSessionId) {
          setSelectedSessionId(sData[0].id);
        }
      } else if (data) {
        const sList = data.sessions || [];
        const rList = data.records || [];
        setSessions(sList);
        setRecords(rList);

        if (sList.length > 0 && !selectedSessionId) {
          setSelectedSessionId(sList[0].id);
        }
      }
    } catch (e) {
      console.warn('Error loading attendance:', e);
    } finally {
      setLoading(false);
    }
  };

  // Whenever selectedSessionId or records change, sync sessionMarks
  useEffect(() => {
    if (!selectedSessionId) return;

    const sessionRecords = records.filter((r) => r.session_id === selectedSessionId);
    const marks = {};
    members.forEach((m) => {
      const existing = sessionRecords.find((r) => r.user_id === m.user_id);
      marks[m.user_id] = {
        status: existing ? existing.status : 'present',
        notes: existing ? (existing.contribution_notes || '') : ''
      };
    });

    setSessionMarks(marks);
    setInitialMarks(JSON.parse(JSON.stringify(marks)));
  }, [selectedSessionId, records, members]);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!isLeader) return;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('attendance_sessions')
        .insert({
          team_id: teamId,
          session_date: newSessionDate,
          title: newSessionTitle.trim(),
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setShowCreateSessionModal(false);
      await loadAttendanceData();
      if (data?.id) setSelectedSessionId(data.id);
    } catch (err) {
      alert('Failed to create session: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkChange = (userId, field, value) => {
    if (!isLeader) return;
    setSessionMarks((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const handleSaveAttendance = async () => {
    if (!isLeader || !selectedSessionId) return;

    // Check if any status changed from initial to prompt for correction reason
    let hasModifications = false;
    for (const userId of Object.keys(sessionMarks)) {
      if (
        initialMarks[userId] &&
        (initialMarks[userId].status !== sessionMarks[userId].status ||
          initialMarks[userId].notes !== sessionMarks[userId].notes)
      ) {
        hasModifications = true;
        break;
      }
    }

    let reasonToLog = correctionReason.trim();
    if (hasModifications && Object.keys(initialMarks).length > 0 && !reasonToLog) {
      reasonToLog = window.prompt(
        'Reason for attendance update/correction (recorded in immutable audit log):',
        'Leader verified contribution adjustments'
      );
      if (reasonToLog === null) return; // user cancelled
    }

    try {
      setSaving(true);

      // Save each member mark using RPC or upsert
      for (const m of members) {
        const mark = sessionMarks[m.user_id] || { status: 'present', notes: '' };
        await supabase.rpc('record_member_attendance', {
          p_session_id: selectedSessionId,
          p_team_id: teamId,
          p_user_id: m.user_id,
          p_status: mark.status,
          p_contribution_notes: mark.notes || null,
          p_correction_reason: reasonToLog || 'Attendance recorded by team leader'
        });
      }

      // Notify team via Push
      try {
        const currentSession = sessions.find((s) => s.id === selectedSessionId);
        const leaderName = profile?.username?.trim() || profile?.user_id || 'Team Leader';
        const teamTag = teamName ? ` • ${teamName}` : '';
        dispatchPushNotification({
          teamId,
          title: `⏱️ ${leaderName}${teamTag}`,
          message: `Verified work attendance for session "${currentSession?.title || 'Daily Standup'}".`,
          url: window.location.origin + '/#/workspace',
          tag: 'attendance-recorded'
        });
      } catch (e) {}

      setCorrectionReason('');
      await loadAttendanceData();
      alert('✅ Work attendance and verified contributions successfully saved!');
    } catch (err) {
      alert('Failed to save attendance: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const viewAuditLogs = async () => {
    setShowAuditModal(true);
    try {
      setLoadingAudit(true);
      const { data, error } = await supabase
        .from('attendance_audit_logs')
        .select('*, changed_by_profile:changed_by(username, user_id)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAuditLogs(data);
      }
    } catch (e) {
      console.warn('Audit fetch error:', e);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Helper to calculate verified statistics for a member
  const calculateMemberStats = (userId) => {
    const memberRecords = records.filter((r) => r.user_id === userId);
    let presentCount = 0;
    let partialCount = 0;
    let absentCount = 0;
    let excusedCount = 0;

    memberRecords.forEach((r) => {
      if (r.status === 'present') presentCount += 1;
      else if (r.status === 'partial') partialCount += 1;
      else if (r.status === 'absent') absentCount += 1;
      else if (r.status === 'excused') excusedCount += 1;
    });

    const eligibleSessions = memberRecords.length - excusedCount;
    const weightedScore = presentCount * 1.0 + partialCount * 0.5;
    const percentage = eligibleSessions > 0 ? Math.round((weightedScore / eligibleSessions) * 100) : 100;

    return {
      total: memberRecords.length,
      present: presentCount,
      partial: partialCount,
      absent: absentCount,
      excused: excusedCount,
      percentage
    };
  };

  const currentSession = sessions.find((s) => s.id === selectedSessionId);
  const myStats = calculateMemberStats(user?.id);

  return (
    <div className="attendance-container">
      {/* Top Header */}
      <div className="attendance-header">
        <div className="attendance-title-box">
          <span style={{ fontSize: '1.4rem' }}>⏱️</span>
          <div>
            <h3>Work Attendance & Contribution Tracking</h3>
            <p>Strictly leader-controlled attendance with verified contributions & audit trail.</p>
          </div>
        </div>

        <div className="attendance-header-actions">
          <button 
            type="button" 
            onClick={viewAuditLogs}
            className="btn btn-secondary btn-sm"
            title="Inspect audit log for leader modifications"
          >
            🛡️ View Audit Trail
          </button>

          {isLeader && (
            <button
              type="button"
              onClick={() => setShowCreateSessionModal(true)}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700 }}
            >
              ➕ Create Work Session
            </button>
          )}
        </div>
      </div>

      {/* Member Scorecard Summary Card */}
      <div className="attendance-scorecard-grid">
        <div className="attendance-scorecard my-card">
          <div className="scorecard-top">
            <span className="scorecard-label">Your Verified Attendance Score</span>
            <span className="scorecard-score" style={{ color: myStats.percentage >= 80 ? '#34d399' : myStats.percentage >= 60 ? '#fbbf24' : '#f87171' }}>
              {myStats.percentage}%
            </span>
          </div>
          <div className="scorecard-pills">
            <span className="sc-pill present">Present: {myStats.present}</span>
            <span className="sc-pill partial">Partial: {myStats.partial}</span>
            <span className="sc-pill absent">Absent: {myStats.absent}</span>
            <span className="sc-pill excused">Excused: {myStats.excused}</span>
          </div>
          <p className="scorecard-note">
            *Excused days are excluded from the percentage denominator.
          </p>
        </div>

        <div className="attendance-scorecard team-card">
          <div className="scorecard-top">
            <span className="scorecard-label">Total Recorded Sessions</span>
            <span className="scorecard-score" style={{ color: '#6C63FF' }}>
              {sessions.length}
            </span>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            {isLeader 
              ? 'As Team Leader, you evaluate work contributions and provide verification remarks.' 
              : 'Attendance is evaluated and verified exclusively by your team leader.'}
          </p>
        </div>
      </div>

      {/* Session Selector & Manager */}
      {sessions.length === 0 ? (
        <div className="attendance-empty-card">
          <span style={{ fontSize: '2.5rem' }}>📅</span>
          <h4>No Attendance Sessions Recorded Yet</h4>
          <p>
            {isLeader 
              ? 'Click "Create Work Session" above to start logging daily attendance and verified team contributions.' 
              : 'Your team leader has not recorded any work sessions yet.'}
          </p>
        </div>
      ) : (
        <div className="attendance-session-panel">
          <div className="session-select-row">
            <div className="flex gap-1" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: '#fbbf24', fontWeight: 700 }}>
                📅 Work Session:
              </span>
              <select
                className="form-input session-dropdown"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.session_date} — {s.title}
                  </option>
                ))}
              </select>
            </div>

            {isLeader && (
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={saving}
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 700, padding: '7px 18px' }}
              >
                {saving ? 'Saving...' : '💾 Save & Verify Attendance'}
              </button>
            )}
          </div>

          {/* Member Evaluation Table */}
          <div className="attendance-table-wrapper">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Team Member</th>
                  <th style={{ width: '25%' }}>Status</th>
                  <th style={{ width: '35%' }}>Verified Contribution Notes</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Overall %</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const mark = sessionMarks[m.user_id] || { status: 'present', notes: '' };
                  const stats = calculateMemberStats(m.user_id);
                  const isCurrent = m.user_id === user?.id;

                  return (
                    <tr key={m.user_id} className={isCurrent ? 'current-user-row' : ''}>
                      <td>
                        <div className="table-member-cell">
                          <div style={{ fontWeight: 600, color: '#fff' }}>
                            {m.profiles?.username || m.profiles?.user_id}
                            {m.role === 'leader' && <span className="leader-pill">LEADER</span>}
                            {isCurrent && <span className="you-pill">YOU</span>}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--accent)' }}>
                            {m.member_role || (m.role === 'leader' ? 'Team Lead' : 'Member')}
                          </div>
                        </div>
                      </td>

                      <td>
                        {isLeader ? (
                          <div className="status-selector-grid">
                            {STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleMarkChange(m.user_id, 'status', opt.value)}
                                className={`btn-status-pill ${mark.status === opt.value ? 'active' : ''}`}
                                style={{
                                  borderColor: mark.status === opt.value ? opt.color : 'rgba(255,255,255,0.1)',
                                  backgroundColor: mark.status === opt.value ? opt.bg : 'transparent',
                                  color: mark.status === opt.value ? opt.color : '#888'
                                }}
                              >
                                {opt.label.split('/')[0]}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div>
                            {(() => {
                              const sInfo = STATUS_OPTIONS.find((o) => o.value === mark.status) || STATUS_OPTIONS[0];
                              return (
                                <span
                                  className="readonly-status-tag"
                                  style={{ color: sInfo.color, background: sInfo.bg, border: `1px solid ${sInfo.color}` }}
                                >
                                  {sInfo.label}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </td>

                      <td>
                        {isLeader ? (
                          <textarea
                            className="attendance-notes-input"
                            rows={2}
                            placeholder="Add verified notes (e.g. Completed feature PR #4, attended standup)..."
                            value={mark.notes}
                            onChange={(e) => handleMarkChange(m.user_id, 'notes', e.target.value)}
                          />
                        ) : (
                          <div className="readonly-notes">
                            {mark.notes || <em style={{ color: '#666' }}>No specific remarks recorded for this day.</em>}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="table-stat-badge"
                          style={{
                            color: stats.percentage >= 80 ? '#34d399' : stats.percentage >= 60 ? '#fbbf24' : '#f87171'
                          }}
                        >
                          {stats.percentage}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE WORK SESSION MODAL */}
      {showCreateSessionModal && (
        <div className="pro-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowCreateSessionModal(false)}>
          <div className="pro-task-modal">
            <div className="pro-task-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>➕ Create Work Attendance Session</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#8888aa' }}>Set up a new tracking milestone, standup, or sprint day.</p>
              </div>
              <button onClick={() => setShowCreateSessionModal(false)} className="pro-settings-close-btn">✕</button>
            </div>

            <form onSubmit={handleCreateSession} className="pro-task-modal-body">
              <div className="form-group">
                <label className="pro-form-label">Session Date <span style={{ color: '#f87171' }}>*</span></label>
                <input 
                  type="date"
                  className="pro-date-picker-input"
                  value={newSessionDate}
                  onChange={(e) => setNewSessionDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="pro-form-label">Session Title / Topic <span style={{ color: '#f87171' }}>*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Sprint Review & Core Deployment"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  required
                />
              </div>

              <div className="pro-task-modal-footer">
                <button type="button" onClick={() => setShowCreateSessionModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL */}
      {showAuditModal && (
        <div className="pro-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowAuditModal(false)}>
          <div className="pro-task-modal" style={{ maxWidth: '680px' }}>
            <div className="pro-task-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>🛡️ Attendance Audit History</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#8888aa' }}>
                  Immutable log of all modifications and status adjustments made by leaders.
                </p>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="pro-settings-close-btn">✕</button>
            </div>

            <div className="pro-task-modal-body">
              {loadingAudit ? (
                <div className="text-muted text-center" style={{ padding: '2rem' }}>Loading audit records...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-muted text-center" style={{ padding: '2rem' }}>No modifications recorded. Attendance is in pristine state.</div>
              ) : (
                <div className="audit-logs-list">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="audit-log-item">
                      <div className="audit-log-top">
                        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
                          Changed by: {log.changed_by_profile?.username || 'Team Leader'}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#8888aa' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="audit-log-change">
                        <span className="audit-tag old">{log.old_status || 'None'}</span>
                        <span style={{ color: '#888' }}>→</span>
                        <span className="audit-tag new">{log.new_status}</span>
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#fbbf24' }}>
                        Reason: "{log.reason}"
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
