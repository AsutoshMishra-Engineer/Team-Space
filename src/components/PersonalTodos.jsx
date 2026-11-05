import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function PersonalTodos({ teams }) {
  const { user } = useAuth();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskText, setTaskText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [adding, setAdding] = useState(false);
  const [extendingId, setExtendingId] = useState(null);
  const [extendedDate, setExtendedDate] = useState('');

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('personal_todos')
        .select('*')
        .eq('user_id', user.id)
        .order('is_done', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (err) {
      console.error('Error fetching todos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchTodos();
  }, [user]);

  const MAX_PRIORITY_TASKS = 5;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!taskText.trim() || adding) return;

    if (!dueDate) {
      alert('⚠️ Deadline is compulsory for tasks! Please select a deadline.');
      return;
    }

    if (pendingTodos.length >= MAX_PRIORITY_TASKS) {
      alert('🎯 Priority Limit Reached: You already have 5 active priority tasks! Firstly finish these 5 priority tasks, after that do other or set other.');
      return;
    }

    try {
      setAdding(true);
      const { error } = await supabase
        .from('personal_todos')
        .insert({
          user_id: user.id,
          task_text: taskText.trim(),
          due_date: dueDate
        });

      if (error) throw error;
      setTaskText('');
      setDueDate('');
      fetchTodos();
    } catch (err) {
      alert('Failed to add task: ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (todo) => {
    try {
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, is_done: !t.is_done } : t))
      );

      const { error } = await supabase
        .from('personal_todos')
        .update({ is_done: !todo.is_done })
        .eq('id', todo.id);

      if (error) throw error;
    } catch (err) {
      alert('Failed to update: ' + err.message);
      fetchTodos();
    }
  };

  const handleExtendDeadline = async (todoId) => {
    if (!extendedDate) {
      alert('Please select a new deadline.');
      return;
    }

    try {
      const { error } = await supabase
        .from('personal_todos')
        .update({ due_date: extendedDate })
        .eq('id', todoId);

      if (error) throw error;
      setExtendingId(null);
      setExtendedDate('');
      fetchTodos();
    } catch (err) {
      alert('Failed to extend deadline: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      setTodos((prev) => prev.filter((t) => t.id !== id));
      const { error } = await supabase
        .from('personal_todos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      alert('Failed to delete: ' + err.message);
      fetchTodos();
    }
  };

  // Check if deadline has passed
  const isOverdue = (dateStr) => {
    if (!dateStr) return false;
    const due = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  const pendingTodos = todos.filter((t) => !t.is_done);
  const completedTodos = todos.filter((t) => t.is_done);
  const isLimitReached = pendingTodos.length >= MAX_PRIORITY_TASKS;

  return (
    <div className="simple-todo-container">
      <div className="simple-todo-header">
        <div>
          <h3 className="simple-todo-title">📝 My Priority Tasks & Deadlines</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Focus on your top 5 daily priorities
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`simple-todo-badge ${isLimitReached ? 'badge-limit-full' : ''}`}>
            {pendingTodos.length}/{MAX_PRIORITY_TASKS} Priority Tasks
          </span>
          <span className="simple-todo-badge">Private</span>
        </div>
      </div>

      {/* If 5 priority tasks reached: show priority focus banner; otherwise show add task form */}
      {isLimitReached ? (
        <div className="priority-limit-banner">
          <div className="limit-banner-header">
            <span className="limit-banner-icon">🎯</span>
            <div>
              <h4 className="limit-banner-title">
                5 Priority Tasks Limit Reached ({pendingTodos.length}/{MAX_PRIORITY_TASKS})
              </h4>
              <p className="limit-banner-quote">
                “Firstly finish these 5 priority tasks, after that do other or set other!”
              </p>
            </div>
          </div>
          <div className="limit-banner-footer">
            👉 Complete (<strong>✓</strong>) or Delete (<strong>🗑️</strong>) any of your 5 active tasks below to unlock a new task slot.
          </div>
        </div>
      ) : (
        <form onSubmit={handleAdd} className="simple-todo-form">
          <input
            type="text"
            className="simple-task-input"
            placeholder="Enter your priority task..."
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            required
          />
          <div className="simple-deadline-group">
            <label>
              Deadline <span style={{ color: '#f87171' }}>*(Compulsory)</span>:
            </label>
            <input
              type="date"
              className="pro-date-picker-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onClick={(e) => {
                try { e.target.showPicker?.(); } catch (err) {}
              }}
              required
              min={new Date().toISOString().split('T')[0]}
            />
            <div className="date-quick-presets">
              <button
                type="button"
                onClick={() => setDueDate(new Date().toISOString().split('T')[0])}
                className="btn-date-preset"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setDueDate(d.toISOString().split('T')[0]);
                }}
                className="btn-date-preset"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 3);
                  setDueDate(d.toISOString().split('T')[0]);
                }}
                className="btn-date-preset"
              >
                +3 Days
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={adding || !taskText.trim() || !dueDate}
            className="simple-add-btn"
          >
            {adding ? 'Adding...' : '+ Add Priority Task'}
          </button>
        </form>
      )}

      {/* Active Tasks List */}
      <div className="simple-todo-section">
        {loading ? (
          <div className="text-muted" style={{ padding: '1rem', textAlign: 'center' }}>
            Loading tasks...
          </div>
        ) : pendingTodos.length === 0 ? (
          <div className="simple-empty-note">
            ✨ No pending tasks. Add a priority task with a deadline above!
          </div>
        ) : (
          <div className="simple-task-list">
            {pendingTodos.map((todo) => {
              const overdue = isOverdue(todo.due_date);

              return (
                <div
                  key={todo.id}
                  className={`simple-task-card ${overdue ? 'simple-card-overdue' : ''}`}
                >
                  <div className="simple-task-main">
                    <span className="simple-task-text">{todo.task_text}</span>
                    {todo.due_date && (
                      <span className={`simple-deadline-tag ${overdue ? 'tag-overdue' : ''}`}>
                        📅 Due: {new Date(todo.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Deadline Passed Prompt: Complete or Extend */}
                  {overdue ? (
                    <div className="simple-overdue-alert">
                      <span className="alert-text">⚠️ Deadline passed! Did you complete it?</span>
                      <div className="simple-btn-group">
                        <button
                          onClick={() => handleToggle(todo)}
                          className="simple-complete-btn"
                        >
                          ✅ Completed
                        </button>
                        <button
                          onClick={() => {
                            setExtendingId(extendingId === todo.id ? null : todo.id);
                            setExtendedDate(todo.due_date ? todo.due_date.split('T')[0] : '');
                          }}
                          className="simple-extend-btn"
                        >
                          ⏳ Extend Time
                        </button>
                      </div>

                      {/* Extend Date Picker Drawer */}
                      {extendingId === todo.id && (
                        <div className="simple-extend-picker">
                          <input
                            type="date"
                            value={extendedDate}
                            onChange={(e) => setExtendedDate(e.target.value)}
                            className="simple-date-input"
                            min={new Date().toISOString().split('T')[0]}
                            required
                          />
                          <button
                            onClick={() => handleExtendDeadline(todo.id)}
                            className="simple-save-date-btn"
                          >
                            Save New Deadline
                          </button>
                          <button
                            onClick={() => { setExtendingId(null); setExtendedDate(''); }}
                            className="btn btn-ghost btn-small"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Normal active task actions */
                    <div style={{ width: '100%' }}>
                      <div className="simple-action-row" style={{ justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleToggle(todo)}
                          className="simple-done-btn"
                          title="Mark task as complete"
                        >
                          ✓ Mark Complete
                        </button>
                        <button
                          onClick={() => {
                            setExtendingId(extendingId === todo.id ? null : todo.id);
                            setExtendedDate(todo.due_date ? todo.due_date.split('T')[0] : '');
                          }}
                          className="simple-extend-btn-normal"
                          title="Extend or change task deadline"
                        >
                          ⏳ Extend
                        </button>
                        <button
                          onClick={() => handleDelete(todo.id)}
                          className="simple-del-btn"
                          title="Delete task"
                        >
                          🗑️
                        </button>
                      </div>

                      {/* Inline Extend Date Drawer for normal tasks */}
                      {extendingId === todo.id && (
                        <div className="simple-extend-picker">
                          <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 600 }}>
                            New Deadline:
                          </span>
                          <input
                            type="date"
                            value={extendedDate}
                            onChange={(e) => setExtendedDate(e.target.value)}
                            className="simple-date-input"
                            min={new Date().toISOString().split('T')[0]}
                            required
                          />
                          <button
                            onClick={() => handleExtendDeadline(todo.id)}
                            className="simple-save-date-btn"
                          >
                            Save New Deadline
                          </button>
                          <button
                            onClick={() => { setExtendingId(null); setExtendedDate(''); }}
                            className="btn btn-ghost btn-small"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Record of Done / Completed Tasks */}
      {completedTodos.length > 0 && (
        <div className="simple-completed-record">
          <div className="record-header">
            <h4>📋 Record of Completed Tasks ({completedTodos.length})</h4>
          </div>
          <div className="simple-task-list">
            {completedTodos.map((todo) => (
              <div key={todo.id} className="simple-task-card simple-card-done">
                <div className="simple-task-main">
                  <span className="simple-done-text">✓ {todo.task_text}</span>
                  {todo.due_date && (
                    <span className="simple-deadline-tag tag-done">
                      Finished (was due: {new Date(todo.due_date).toLocaleDateString()})
                    </span>
                  )}
                </div>
                <div className="simple-action-row">
                  <button
                    onClick={() => handleToggle(todo)}
                    className="simple-undo-btn"
                    title="Undo to pending"
                  >
                    ↩ Undo
                  </button>
                  <button
                    onClick={() => handleDelete(todo.id)}
                    className="simple-del-btn"
                    title="Delete permanently"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
