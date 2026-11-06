import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { dispatchPushNotification } from '../lib/pushService';

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.3)' },
  medium: { label: 'Medium', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)' },
  high: { label: 'High', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)' },
  critical: { label: '🚨 Critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)', border: '#ef4444' }
};

const STATUS_CONFIG = {
  assigned: { label: 'Assigned', badge: 'status-assigned', icon: '📥' },
  accepted: { label: 'Accepted', badge: 'status-accepted', icon: '👍' },
  in_progress: { label: 'In Progress', badge: 'status-progress', icon: '⚙️' },
  review_pending: { label: 'Review Pending', badge: 'status-review', icon: '👀' },
  completed: { label: 'Completed', badge: 'status-completed', icon: '✅' },
  changes_requested: { label: 'Changes Requested', badge: 'status-changes', icon: '⚠️' }
};

export default function SmartTasks({ teamId, isLeader, members = [] }) {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'my_tasks' | 'review_pending' | 'completed'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(null); // task to submit
  const [showReviewModal, setShowReviewModal] = useState(null); // task for leader to review
  const [showHistoryModal, setShowHistoryModal] = useState(null); // task activity log

  // Form states for Create Task
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [checklistItems, setChecklistItems] = useState([]);
  const [creating, setCreating] = useState(false);

  // Form states for Member Submission
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states for Leader Review
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Activity logs for history modal
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (teamId) {
      fetchTasks();

      // Realtime subscription
      const channel = supabase
        .channel(`smart-tasks-${teamId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_tasks', filter: `team_id=eq.${teamId}` }, () => {
          fetchTasks();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [teamId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('team_tasks')
        .select(`
          *,
          assignee:profiles!team_tasks_assigned_to_fkey(user_id, username, email),
          creator:profiles!team_tasks_created_by_fkey(user_id, username),
          task_checklists(*)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (e) {
      console.warn('Error fetching smart tasks:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklistItems([...checklistItems, newChecklistText.trim()]);
    setNewChecklistText('');
  };

  const handleRemoveChecklistItem = (idx) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== idx));
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDeadline) {
      alert('Please provide a task title and deadline.');
      return;
    }

    try {
      setCreating(true);
      const { data: createdTask, error } = await supabase
        .from('team_tasks')
        .insert({
          team_id: teamId,
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          priority: newPriority,
          assigned_to: newAssignee || null,
          created_by: user.id,
          deadline: newDeadline,
          status: 'assigned'
        })
        .select()
        .single();

      if (error) throw error;

      // Insert checklists if any
      if (checklistItems.length > 0 && createdTask?.id) {
        const rows = checklistItems.map((title, idx) => ({
          task_id: createdTask.id,
          title,
          position: idx
        }));
        await supabase.from('task_checklists').insert(rows);
      }

      // Initial activity log
      await supabase.from('task_activity_logs').insert({
        task_id: createdTask.id,
        user_id: user.id,
        new_status: 'assigned',
        comment: `Task created and assigned by ${profile?.username || profile?.user_id || 'Team Leader'}`
      });

      // Dispatch Web Push notification to assignee
      if (newAssignee) {
        try {
          dispatchPushNotification({
            teamId,
            userId: newAssignee,
            title: `📋 New Task Assigned: ${newTitle}`,
            message: `You were assigned a ${newPriority.toUpperCase()} priority task. Deadline: ${new Date(newDeadline).toLocaleDateString()}`,
            url: window.location.origin + '/#/workspace',
            tag: 'task-assigned'
          });
        } catch (err) {}
      }

      // Reset form
      setNewTitle('');
      setNewDesc('');
      setNewPriority('medium');
      setNewAssignee('');
      setNewDeadline('');
      setChecklistItems([]);
      setShowCreateModal(false);
      fetchTasks();
    } catch (err) {
      alert('Failed to create task: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleChecklist = async (checklistId, currentStatus) => {
    try {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          task_checklists: (t.task_checklists || []).map((c) =>
            c.id === checklistId ? { ...c, is_done: !currentStatus } : c
          )
        }))
      );

      await supabase
        .from('task_checklists')
        .update({ is_done: !currentStatus })
        .eq('id', checklistId);
    } catch (e) {
      console.warn('Checklist update error:', e);
      fetchTasks();
    }
  };

  const handleTransition = async (taskId, newStatus, comment = null) => {
    try {
      const { data, error } = await supabase.rpc('transition_task_status', {
        p_task_id: taskId,
        p_new_status: newStatus,
        p_comment: comment
      });

      if (error) {
        // Fallback direct update
        await supabase.from('team_tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId);
        await supabase.from('task_activity_logs').insert({
          task_id: taskId,
          user_id: user.id,
          new_status: newStatus,
          comment
        });
      }

      fetchTasks();
    } catch (err) {
      alert('Status update failed: ' + err.message);
    }
  };

  const handleSubmitForReview = async (e) => {
    e.preventDefault();
    if (!showSubmitModal) return;

    try {
      setSubmitting(true);
      const { error } = await supabase.rpc('transition_task_status', {
        p_task_id: showSubmitModal.id,
        p_new_status: 'review_pending',
        p_submission_notes: submissionNotes.trim() || null,
        p_submission_link: submissionLink.trim() || null,
        p_comment: `Member submitted work for review. Notes: ${submissionNotes.substring(0, 50)}...`
      });

      if (error) throw error;

      // Notify team leader
      try {
        dispatchPushNotification({
          teamId,
          title: `👀 Task Ready for Review: ${showSubmitModal.title}`,
          message: `${profile?.username || 'Member'} has submitted their work for review.`,
          url: window.location.origin + '/#/workspace',
          tag: 'task-review'
        });
      } catch (e) {}

      setShowSubmitModal(null);
      setSubmissionNotes('');
      setSubmissionLink('');
      fetchTasks();
    } catch (err) {
      alert('Failed to submit task: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaderReviewAction = async (decision) => {
    if (!showReviewModal) return;
    if (decision === 'changes_requested' && !feedbackNotes.trim()) {
      alert('Please provide instructions/feedback so the member knows what changes are requested.');
      return;
    }

    try {
      setReviewing(true);
      const newStatus = decision === 'approve' ? 'completed' : 'changes_requested';
      const comment = decision === 'approve' 
        ? `Team leader approved the submission.` 
        : `Leader requested revisions: ${feedbackNotes.trim()}`;

      const { error } = await supabase.rpc('transition_task_status', {
        p_task_id: showReviewModal.id,
        p_new_status: newStatus,
        p_leader_feedback: feedbackNotes.trim() || null,
        p_comment: comment
      });

      if (error) throw error;

      // Push notify assignee
      if (showReviewModal.assigned_to) {
        try {
          dispatchPushNotification({
            teamId,
            userId: showReviewModal.assigned_to,
            title: decision === 'approve' ? `🎉 Task Approved!` : `⚠️ Revisions Requested`,
            message: decision === 'approve'
              ? `Leader marked "${showReviewModal.title}" as Completed!`
              : `Leader feedback: ${feedbackNotes.trim()}`,
            url: window.location.origin + '/#/workspace',
            tag: 'task-decision'
          });
        } catch (e) {}
      }

      setShowReviewModal(null);
      setFeedbackNotes('');
      fetchTasks();
    } catch (err) {
      alert('Review action failed: ' + err.message);
    } finally {
      setReviewing(false);
    }
  };

  const openHistory = async (task) => {
    setShowHistoryModal(task);
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from('task_activity_logs')
        .select('*, profiles:user_id(username, user_id)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setActivityLogs(data);
      }
    } catch (e) {
      console.warn('Failed to load history:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filter === 'my_tasks') return t.assigned_to === user?.id;
    if (filter === 'review_pending') return t.status === 'review_pending';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  return (
    <div className="smart-tasks-container">
      {/* Top Header Bar */}
      <div className="smart-tasks-header">
        <div>
          <div className="smart-tasks-title">
            <span style={{ fontSize: '1.4rem' }}>📋</span>
            <div>
              <h3>Smart Task Management</h3>
              <p>6-State lifecycle workflow with leader approvals, checklists & evidence submissions.</p>
            </div>
          </div>
        </div>

        <div className="smart-tasks-actions">
          {/* Filter Pills */}
          <div className="task-filter-pills">
            <button 
              className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({tasks.length})
            </button>
            <button 
              className={`filter-pill ${filter === 'my_tasks' ? 'active' : ''}`}
              onClick={() => setFilter('my_tasks')}
            >
              Assigned to Me ({tasks.filter(t => t.assigned_to === user?.id).length})
            </button>
            <button 
              className={`filter-pill ${filter === 'review_pending' ? 'active' : ''}`}
              onClick={() => setFilter('review_pending')}
            >
              Awaiting Review ({tasks.filter(t => t.status === 'review_pending').length})
            </button>
            <button 
              className={`filter-pill ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed ({tasks.filter(t => t.status === 'completed').length})
            </button>
          </div>

          {isLeader && (
            <button 
              type="button" 
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700, gap: '6px' }}
            >
              <span>➕</span> Create New Task
            </button>
          )}
        </div>
      </div>

      {/* Task Grid */}
      {loading ? (
        <div className="text-muted text-center" style={{ padding: '3rem' }}>
          Loading team tasks...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="smart-tasks-empty-card">
          <span style={{ fontSize: '2.5rem' }}>🎯</span>
          <h4>No tasks found for this view</h4>
          <p>
            {isLeader 
              ? 'Click "Create New Task" above to assign structured deliverables with deadlines to your team.' 
              : 'You are all caught up! When leaders assign tasks to you, they will appear right here.'}
          </p>
        </div>
      ) : (
        <div className="smart-tasks-grid">
          {filteredTasks.map((task) => {
            const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
            const statusInfo = STATUS_CONFIG[task.status] || STATUS_CONFIG.assigned;
            const isAssignee = task.assigned_to === user?.id;
            const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
            const checklists = task.task_checklists || [];
            const doneChecklists = checklists.filter(c => c.is_done).length;

            return (
              <div key={task.id} className={`smart-task-card ${isOverdue ? 'task-overdue-border' : ''}`}>
                {/* Card Top: Priority & Status Badges */}
                <div className="task-card-top">
                  <div className="flex gap-1" style={{ alignItems: 'center' }}>
                    <span 
                      className="task-priority-badge" 
                      style={{ 
                        color: priorityInfo.color, 
                        background: priorityInfo.bg, 
                        border: `1px solid ${priorityInfo.border}` 
                      }}
                    >
                      {priorityInfo.label}
                    </span>
                    <span className={`task-status-badge ${statusInfo.badge}`}>
                      {statusInfo.icon} {statusInfo.label}
                    </span>
                  </div>

                  <button 
                    onClick={() => openHistory(task)}
                    className="task-btn-history"
                    title="View task activity history"
                  >
                    🕒 History
                  </button>
                </div>

                {/* Title & Description */}
                <h4 className="task-title">{task.title}</h4>
                {task.description && (
                  <p className="task-desc">{task.description}</p>
                )}

                {/* Checklists */}
                {checklists.length > 0 && (
                  <div className="task-checklists-wrapper">
                    <div className="task-checklists-head">
                      <span>Subtasks Progress:</span>
                      <strong style={{ color: '#6ee7b7' }}>{doneChecklists}/{checklists.length}</strong>
                    </div>
                    <div className="task-progress-track">
                      <div 
                        className="task-progress-fill" 
                        style={{ width: `${(doneChecklists / checklists.length) * 100}%` }}
                      />
                    </div>
                    <div className="task-checklists-items">
                      {checklists.map((c) => (
                        <label key={c.id} className="task-checklist-row">
                          <input 
                            type="checkbox" 
                            checked={c.is_done}
                            onChange={() => handleToggleChecklist(c.id, c.is_done)}
                            disabled={!isAssignee && !isLeader}
                          />
                          <span className={c.is_done ? 'item-checked' : ''}>{c.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback or Notes Callout if changes requested or review pending */}
                {task.status === 'changes_requested' && task.leader_feedback && (
                  <div className="task-feedback-box changes">
                    <strong style={{ color: '#f87171' }}>⚠️ Revision Notes from Leader:</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>{task.leader_feedback}</p>
                  </div>
                )}

                {task.status === 'review_pending' && task.submission_notes && (
                  <div className="task-feedback-box review">
                    <strong style={{ color: '#fbbf24' }}>📤 Member Submission Attached:</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>{task.submission_notes}</p>
                    {task.submission_link && (
                      <a href={task.submission_link} target="_blank" rel="noreferrer" className="task-proof-link">
                        🔗 Open Work Link / PR
                      </a>
                    )}
                  </div>
                )}

                {/* Card Meta Footer */}
                <div className="task-card-meta">
                  <div className="task-meta-item">
                    <span className="task-meta-label">Assignee:</span>
                    <span className="task-meta-val">
                      {task.assignee?.username || task.assignee?.user_id || 'Unassigned'}
                      {isAssignee && <span className="you-pill">YOU</span>}
                    </span>
                  </div>

                  <div className="task-meta-item">
                    <span className="task-meta-label">Deadline:</span>
                    <span className={`task-meta-val ${isOverdue ? 'overdue' : ''}`}>
                      ⏰ {new Date(task.deadline).toLocaleDateString()}
                      {isOverdue && ' (OVERDUE)'}
                    </span>
                  </div>
                </div>

                {/* Workflow Actions */}
                <div className="task-card-actions">
                  {/* Assignee Actions */}
                  {isAssignee && task.status === 'assigned' && (
                    <button 
                      type="button" 
                      onClick={() => handleTransition(task.id, 'accepted', 'Member accepted task')}
                      className="btn btn-primary btn-sm w-full"
                    >
                      👍 Accept Task
                    </button>
                  )}

                  {isAssignee && task.status === 'accepted' && (
                    <button 
                      type="button" 
                      onClick={() => handleTransition(task.id, 'in_progress', 'Started working')}
                      className="btn btn-primary btn-sm w-full"
                    >
                      🚀 Start Working
                    </button>
                  )}

                  {isAssignee && (task.status === 'in_progress' || task.status === 'changes_requested') && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowSubmitModal(task);
                        setSubmissionNotes('');
                        setSubmissionLink('');
                      }}
                      className="btn btn-primary btn-sm w-full"
                    >
                      📤 Submit Work for Review
                    </button>
                  )}

                  {/* Leader Actions */}
                  {isLeader && task.status === 'review_pending' && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowReviewModal(task);
                        setFeedbackNotes('');
                      }}
                      className="btn btn-review-action w-full"
                    >
                      🔍 Review & Approve / Request Changes
                    </button>
                  )}

                  {task.status === 'completed' && (
                    <div className="task-completed-label">
                      ✨ Task Completed & Verified
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="pro-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="pro-task-modal">
            <div className="pro-task-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>➕ Assign New Team Task</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#8888aa' }}>Set clear expectations, priority, assignees, and deadlines.</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="pro-settings-close-btn">✕</button>
            </div>

            <form onSubmit={handleCreateTask} className="pro-task-modal-body">
              <div className="form-group">
                <label className="pro-form-label">Task Title <span style={{ color: '#f87171' }}>*</span></label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Implement authentication callback edge case"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="pro-form-label">Description & Instructions</label>
                <textarea 
                  className="form-input" 
                  rows={3}
                  placeholder="Detailed guidelines, specs, and acceptance criteria..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="pro-form-label">Priority</label>
                  <select 
                    className="form-input" 
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="critical">🚨 Critical / Blocker</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="pro-form-label">Assignee</label>
                  <select 
                    className="form-input"
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                  >
                    <option value="">Unassigned (Open Pool)</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profiles?.username || m.profiles?.user_id} ({m.member_role || m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="pro-form-label">Compulsory Deadline <span style={{ color: '#f87171' }}>*</span></label>
                <input 
                  type="date" 
                  className="pro-date-picker-input"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              {/* Subtasks / Checklist Creator */}
              <div className="form-group">
                <label className="pro-form-label">Checklist Milestones (Optional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Add a milestone/step..."
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                  />
                  <button type="button" onClick={handleAddChecklistItem} className="btn btn-secondary btn-sm">
                    Add
                  </button>
                </div>

                {checklistItems.length > 0 && (
                  <ul className="modal-checklist-list">
                    {checklistItems.map((item, idx) => (
                      <li key={idx}>
                        <span>{item}</span>
                        <button type="button" onClick={() => handleRemoveChecklistItem(idx)} className="btn-remove-item">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pro-task-modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary">
                  {creating ? 'Assigning Task...' : '🚀 Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEMBER SUBMIT FOR REVIEW MODAL */}
      {showSubmitModal && (
        <div className="pro-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowSubmitModal(null)}>
          <div className="pro-task-modal">
            <div className="pro-task-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>📤 Submit Task for Review</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#8888aa' }}>
                  {showSubmitModal.title}
                </p>
              </div>
              <button onClick={() => setShowSubmitModal(null)} className="pro-settings-close-btn">✕</button>
            </div>

            <form onSubmit={handleSubmitForReview} className="pro-task-modal-body">
              <div className="form-group">
                <label className="pro-form-label">Submission Notes & Summary of Work <span style={{ color: '#f87171' }}>*</span></label>
                <textarea 
                  className="form-input" 
                  rows={4}
                  placeholder="Explain what was accomplished, files changed, or verification steps..."
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="pro-form-label">Link to Pull Request, Document or Preview (Optional)</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://github.com/... or https://..."
                  value={submissionLink}
                  onChange={(e) => setSubmissionLink(e.target.value)}
                />
              </div>

              <div className="pro-task-modal-footer">
                <button type="button" onClick={() => setShowSubmitModal(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Submitting...' : '🚀 Submit for Leader Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEADER REVIEW & APPROVAL MODAL */}
      {showReviewModal && (
        <div className="pro-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowReviewModal(null)}>
          <div className="pro-task-modal">
            <div className="pro-task-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>🔍 Review Member Work</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#8888aa' }}>
                  {showReviewModal.title}
                </p>
              </div>
              <button onClick={() => setShowReviewModal(null)} className="pro-settings-close-btn">✕</button>
            </div>

            <div className="pro-task-modal-body">
              {/* Member notes */}
              <div className="task-review-submission-box">
                <span className="task-meta-label">Submitted by Assignee:</span>
                <p style={{ margin: '6px 0', fontSize: '0.88rem', color: '#eee', whiteSpace: 'pre-wrap' }}>
                  {showReviewModal.submission_notes || 'No notes provided.'}
                </p>
                {showReviewModal.submission_link && (
                  <div style={{ marginTop: '8px' }}>
                    <a href={showReviewModal.submission_link} target="_blank" rel="noreferrer" className="task-proof-link">
                      🔗 Open Submitted Work Link
                    </a>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="pro-form-label">Feedback / Revision Notes (Required if requesting changes):</label>
                <textarea 
                  className="form-input" 
                  rows={3}
                  placeholder="Explain what looks great or what specific items need adjustment..."
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                />
              </div>

              <div className="pro-review-split-actions">
                <button 
                  type="button" 
                  onClick={() => handleLeaderReviewAction('changes_requested')}
                  disabled={reviewing}
                  className="btn btn-danger-action"
                >
                  ⚠️ Request Changes
                </button>

                <button 
                  type="button" 
                  onClick={() => handleLeaderReviewAction('approve')}
                  disabled={reviewing}
                  className="btn btn-approve-action"
                >
                  ✅ Approve & Mark Completed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TASK ACTIVITY LOG MODAL */}
      {showHistoryModal && (
        <div className="pro-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowHistoryModal(null)}>
          <div className="pro-task-modal">
            <div className="pro-task-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>🕒 Task Activity Audit Log</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#8888aa' }}>{showHistoryModal.title}</p>
              </div>
              <button onClick={() => setShowHistoryModal(null)} className="pro-settings-close-btn">✕</button>
            </div>

            <div className="pro-task-modal-body">
              {loadingLogs ? (
                <div className="text-muted text-center" style={{ padding: '2rem' }}>Loading activity logs...</div>
              ) : activityLogs.length === 0 ? (
                <div className="text-muted text-center" style={{ padding: '2rem' }}>No transitions recorded yet.</div>
              ) : (
                <div className="task-activity-timeline">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <strong>{log.profiles?.username || 'Team User'}</strong>
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div className="timeline-status-shift">
                          {log.old_status && <span className="old-status">{log.old_status}</span>}
                          {log.old_status && <span className="shift-arrow">→</span>}
                          <span className="new-status">{log.new_status}</span>
                        </div>
                        {log.comment && <p className="timeline-comment">{log.comment}</p>}
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
