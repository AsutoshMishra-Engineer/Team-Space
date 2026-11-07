import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Checks if the user has a valid, non-placeholder display name.
 */
export function isDisplayNameMissing(profile) {
  if (!profile) return false; // wait until profile is loaded
  const name = profile.username;
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (trimmed.length < 2) return true;

  // Check if name is just the raw User ID (e.g., "981EF23")
  if (profile.user_id && trimmed.toLowerCase() === profile.user_id.toLowerCase()) return true;

  // Check common generic placeholders
  const placeholders = ['user', 'team member', 'member', 'unknown', 'anonymous', 'unnamed', 'null', 'undefined'];
  if (placeholders.includes(trimmed.toLowerCase())) return true;

  return false;
}

export default function CompulsoryNameModal() {
  const { user, profile, updateProfile, loading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // If already has valid name or not logged in, do not show
  const needsName = Boolean(user && profile && isDisplayNameMissing(profile));

  useEffect(() => {
    if (profile?.username && !isDisplayNameMissing(profile)) {
      setFullName(profile.username);
    }
  }, [profile]);

  if (loading || !needsName) {
    return null;
  }

  // Generate 1-2 initials for live avatar preview
  const getInitials = (name) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '??';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const currentInitials = getInitials(fullName || profile?.user_id || 'TM');

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanName = fullName.trim();

    if (cleanName.length < 2) {
      setError('Please enter your full name (minimum 2 characters).');
      return;
    }

    if (cleanName.length > 50) {
      setError('Name cannot exceed 50 characters.');
      return;
    }

    // Do not allow setting name to raw user_id or generic placeholder
    if (profile?.user_id && cleanName.toLowerCase() === profile.user_id.toLowerCase()) {
      setError('Please enter your actual name rather than your User ID.');
      return;
    }

    const placeholders = ['user', 'team member', 'member', 'unknown', 'anonymous'];
    if (placeholders.includes(cleanName.toLowerCase())) {
      setError('Please enter your real first and last name.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // 1. Direct update to profiles table (secured by RLS auth.uid() = id)
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          username: cleanName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateErr) {
        // Fallback to RPC function if present
        const { error: rpcErr } = await supabase.rpc('update_profile_info', {
          p_username: cleanName,
          p_avatar_url: profile?.avatar_url || null
        });
        if (rpcErr) throw updateErr;
      }

      // 2. Sync to auth user metadata
      try {
        await supabase.auth.updateUser({
          data: {
            username: cleanName,
            full_name: cleanName
          }
        });
      } catch (metaErr) {
        console.warn('Auth metadata sync note:', metaErr);
      }

      // 3. Immediately update AuthContext so modal dismisses without reload
      updateProfile({
        ...profile,
        username: cleanName
      });
    } catch (err) {
      console.error('Error updating name:', err);
      setError(err.message || 'Failed to save name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="compulsory-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="name-modal-title">
      <div className="compulsory-modal-card">
        {/* Top glowing accent border */}
        <div className="compulsory-modal-glow-bar" />

        <div className="compulsory-modal-header">
          <div className="compulsory-badge">
            <span className="compulsory-badge-dot"></span>
            Compulsory Profile Setup
          </div>
          <h2 id="name-modal-title" className="compulsory-title">What is your Full Name?</h2>
          <p className="compulsory-subtitle">
            To ensure your team recognizes you in notifications, announcements, and task assignments, please set your official name.
          </p>
        </div>

        {/* Live Avatar Preview */}
        <div className="compulsory-avatar-section">
          <div className="compulsory-avatar-circle">
            <span>{currentInitials}</span>
          </div>
          <div className="compulsory-avatar-info">
            <span className="compulsory-avatar-name">{fullName.trim() || 'Your Name'}</span>
            <span className="compulsory-avatar-id">Verified User ID: <strong>{profile?.user_id}</strong></span>
          </div>
        </div>

        {/* Live WhatsApp / Instagram Push Notification Preview */}
        <div className="compulsory-notif-preview-wrapper">
          <div className="compulsory-notif-preview-label">
            <span>📱 Live Teammate Notification Preview</span>
            <span className="compulsory-notif-preview-tag">WhatsApp &amp; Android Style</span>
          </div>
          <div className="compulsory-notif-bubble">
            <div className="compulsory-notif-top">
              <div className="compulsory-notif-app-tag">
                <span className="compulsory-notif-icon">📢</span>
                <strong>{fullName.trim() || 'Your Name'}</strong>
                <span className="compulsory-notif-team">• TeamSpace</span>
              </div>
              <span className="compulsory-notif-time">Just now</span>
            </div>
            <div className="compulsory-notif-body">
              "Hey team, I just posted a new project update and task deadline."
            </div>
          </div>
        </div>

        {error && (
          <div className="compulsory-alert-error" role="alert">
            <span>⚠️</span>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSave} className="compulsory-form">
          <div className="compulsory-input-group">
            <label htmlFor="compulsory-fullname-input" className="compulsory-label">
              Full Name / Display Name <span className="compulsory-required">*</span>
            </label>
            <div className="compulsory-input-box">
              <span className="compulsory-input-icon">👤</span>
              <input
                id="compulsory-fullname-input"
                type="text"
                className="compulsory-input"
                placeholder="e.g. Asutosh Mishra"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (error) setError('');
                }}
                disabled={saving}
                autoFocus
                maxLength={50}
                required
              />
              {fullName.length > 0 && (
                <span className="compulsory-char-count">{fullName.length}/50</span>
              )}
            </div>
            <p className="compulsory-help-text">
              Enter your real name as teammates know you (e.g. Asutosh Mishra or Alex Rivera).
            </p>
          </div>

          <div className="compulsory-footer">
            <button
              type="submit"
              className="compulsory-submit-btn"
              disabled={saving || fullName.trim().length < 2}
            >
              {saving ? (
                <>
                  <span className="compulsory-spinner"></span>
                  Saving Identity...
                </>
              ) : (
                <>
                  Save &amp; Continue to Workspace 🚀
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
