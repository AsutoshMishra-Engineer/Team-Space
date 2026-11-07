import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { dispatchPushNotification } from '../lib/pushService';

export default function AnnouncementAcknowledgement({ announcement, isLeader, teamId, allMembers = [] }) {
  const { user, profile } = useAuth();
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [acknowledgedAt, setAcknowledgedAt] = useState(null);
  const [ackCount, setAckCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [ackList, setAckList] = useState([]);
  const [reminding, setReminding] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  useEffect(() => {
    if (!announcement?.id || !user) return;
    fetchAckStatus();
  }, [announcement?.id, user?.id]);

  const fetchAckStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcement_acknowledgements')
        .select('id, user_id, acknowledged_at')
        .eq('announcement_id', announcement.id);

      if (error) throw error;

      const records = data || [];
      setAckCount(records.length);
      const myAck = records.find((r) => r.user_id === user.id);
      if (myAck) {
        setHasAcknowledged(true);
        setAcknowledgedAt(myAck.acknowledged_at);
      } else {
        setHasAcknowledged(false);
        setAcknowledgedAt(null);
      }
    } catch (e) {
      console.warn('Error fetching ack status:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (submitting || hasAcknowledged || !user || !teamId) return;

    try {
      setSubmitting(true);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('announcement_acknowledgements')
        .insert({
          announcement_id: announcement.id,
          team_id: teamId,
          user_id: user.id,
          acknowledged_at: now
        });

      if (error) throw error;

      setHasAcknowledged(true);
      setAcknowledgedAt(now);
      setAckCount((prev) => prev + 1);
    } catch (err) {
      alert('Failed to acknowledge: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openLeaderModal = async () => {
    setShowModal(true);
    setReminderSent(false);
    try {
      // Use RPC if available, or direct query fallback
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_announcement_acknowledgements', {
        p_announcement_id: announcement.id
      });

      if (!rpcErr && rpcData?.acknowledgements) {
        setAckList(rpcData.acknowledgements);
        return;
      }

      // Fallback
      const { data, error } = await supabase
        .from('announcement_acknowledgements')
        .select('id, user_id, acknowledged_at, profiles(user_id, username, email)')
        .eq('announcement_id', announcement.id);

      if (!error && data) {
        setAckList(data);
      }
    } catch (err) {
      console.warn('Failed to load ack list:', err);
    }
  };

  const sendReminder = async () => {
    try {
      setReminding(true);
      const senderName = profile?.username?.trim() || profile?.user_id || 'Team Leader';
      await dispatchPushNotification({
        teamId,
        title: `✍️ ${senderName} (Action Required)`,
        message: `Please acknowledge announcement: "${announcement.message.substring(0, 60)}..."`,
        url: window.location.origin + '/#/workspace',
        tag: 'ack-reminder'
      });
      setReminderSent(true);
    } catch (e) {
      alert('Reminder dispatch: ' + e.message);
    } finally {
      setReminding(false);
    }
  };

  if (!announcement?.requires_ack && !announcement?.is_important) {
    return null;
  }

  const activeMembersCount = allMembers.length || 1;
  const ackPercentage = Math.min(100, Math.round((ackCount / activeMembersCount) * 100));

  return (
    <div className="announcement-ack-wrapper">
      {/* Badges Row */}
      <div className="ack-badges-row">
        {announcement.is_important && (
          <span className="ack-badge important-badge">
            <span className="pulse-dot"></span> ⚠️ IMPORTANT ANNOUNCEMENT
          </span>
        )}
        {announcement.requires_ack && (
          <span className="ack-badge required-badge">
            ✍️ ACKNOWLEDGEMENT REQUIRED
          </span>
        )}
      </div>

      {/* Member Acknowledgement Action or Status */}
      {announcement.requires_ack && (
        <div className="ack-action-container">
          {hasAcknowledged ? (
            <div className="ack-confirmed-banner">
              <span className="ack-check-icon">✅</span>
              <span>
                You acknowledged this announcement{' '}
                {acknowledgedAt && (
                  <strong style={{ color: '#6ee7b7' }}>
                    ({new Date(acknowledgedAt).toLocaleString()})
                  </strong>
                )}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAcknowledge}
              disabled={submitting}
              className="btn-acknowledge-action"
            >
              {submitting ? '⏳ Recording...' : '✋ Tap Here to Acknowledge'}
            </button>
          )}

          {/* Leader Tracking Button */}
          {isLeader && (
            <button
              type="button"
              onClick={openLeaderModal}
              className="btn-leader-ack-stats"
              title="View member sign-off breakdown"
            >
              📊 Sign-offs: <strong>{ackCount}/{activeMembersCount}</strong> ({ackPercentage}%)
            </button>
          )}
        </div>
      )}

      {/* Leader Modal Tracking Drawer */}
      {showModal && (
        <div className="pro-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="pro-ack-modal">
            <div className="pro-ack-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                  📊 Announcement Acknowledgement Audit
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#8888aa' }}>
                  Real-time status of members who have verified reading this update.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="pro-settings-close-btn">
                ✕
              </button>
            </div>

            {/* Progress bar */}
            <div className="ack-progress-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                <span style={{ color: '#bbb' }}>Total Team Compliance:</span>
                <span style={{ color: ackPercentage >= 80 ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                  {ackCount} of {activeMembersCount} Members ({ackPercentage}%)
                </span>
              </div>
              <div className="ack-progress-track">
                <div 
                  className="ack-progress-fill" 
                  style={{ 
                    width: `${ackPercentage}%`, 
                    backgroundColor: ackPercentage >= 80 ? '#10b981' : ackPercentage >= 50 ? '#f59e0b' : '#6C63FF' 
                  }}
                />
              </div>
            </div>

            {/* Member Sign-off Breakdown */}
            <div className="ack-members-list">
              <h5 style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#9090b8', textTransform: 'uppercase' }}>
                Member Sign-Off List
              </h5>
              {allMembers.map((m) => {
                const ackRecord = ackList.find((a) => a.user_id === m.user_id);
                const isAcked = !!ackRecord;
                const displayName = m.profiles?.username || m.profiles?.user_id || m.user_id.substring(0, 8);

                return (
                  <div key={m.user_id} className={`ack-member-row ${isAcked ? 'acked' : 'pending'}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ack-status-dot">{isAcked ? '🟢' : '⏳'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#eee' }}>
                          {displayName} {m.role === 'leader' && <span className="leader-pill">LEADER</span>}
                        </div>
                        {m.member_role && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--accent)' }}>
                            {m.member_role}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {isAcked ? (
                        <div style={{ fontSize: '0.76rem', color: '#34d399', fontWeight: 600 }}>
                          ✅ {new Date(ackRecord.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <div style={{ fontSize: '0.7rem', color: '#888' }}>
                            {new Date(ackRecord.acknowledged_at).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span className="ack-pending-pill">Awaiting Sign-off</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Leader Reminder Action */}
            <div className="ack-modal-footer">
              <button
                type="button"
                onClick={sendReminder}
                disabled={reminding || reminderSent || ackPercentage === 100}
                className="btn btn-primary btn-sm"
                style={{ width: '100%', padding: '9px 16px', fontWeight: 700 }}
              >
                {reminderSent
                  ? '✅ Push Notification Reminder Sent!'
                  : reminding
                  ? '⏳ Dispatching Mobile Alert...'
                  : '🔔 Send Android Push Reminder to Pending Members'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
