import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import NotificationPreferences from './NotificationPreferences';

const COLOR_OPTIONS = [
  { name: 'Indigo', swatch: '#6C63FF', label: 'Indigo' },
  { name: 'Emerald', swatch: '#10b981', label: 'Emerald' },
  { name: 'Sky', swatch: '#0ea5e9', label: 'Sky Blue' },
  { name: 'Amber', swatch: '#f59e0b', label: 'Amber' },
  { name: 'Rose', swatch: '#f43f5e', label: 'Rose Pink' },
  { name: 'Violet', swatch: '#8b5cf6', label: 'Violet' },
  { name: 'Slate', swatch: '#94a3b8', label: 'Slate' },
];

const BG_OPTIONS = [
  { name: 'Dark', swatch: '#07070f', label: 'Deep Cosmos', desc: 'Dark with purple ambient' },
  { name: 'Navy', swatch: '#0a1225', label: 'Midnight Ocean', desc: 'Deep navy blue' },
  { name: 'Forest', swatch: '#081208', label: 'Obsidian Forest', desc: 'Subtle dark emerald' },
  { name: 'Wine', swatch: '#150a10', label: 'Royal Crimson', desc: 'Deep wine velvet' },
  { name: 'Midnight', swatch: '#08081e', label: 'Starlight Indigo', desc: 'Dark sapphire tone' },
  { name: 'Charcoal', swatch: '#111111', label: 'Studio Noir', desc: 'Pure minimalist dark' },
  { name: 'Coffee', swatch: '#140e08', label: 'Roasted Espresso', desc: 'Warm roasted dark' },
];

export default function PersonalSettings({ onClose }) {
  const { profile, updateProfile, applyTheme, applyBackground, user } = useAuth();
  const [activeTab, setActiveTab] = useState('appearance'); // 'appearance' | 'profile' | 'profile_info' | 'notifications'
  const [selectedColor, setSelectedColor] = useState(profile?.theme_color || 'Indigo');
  const [selectedBg, setSelectedBg] = useState(profile?.bg_color || 'Dark');
  const [quote, setQuote] = useState(profile?.personal_quote || '');
  const [editableName, setEditableName] = useState(profile?.username || '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleUpdateName = async (e) => {
    e?.preventDefault();
    const cleanName = editableName.trim();
    if (cleanName.length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }
    if (profile?.user_id && cleanName.toLowerCase() === profile.user_id.toLowerCase()) {
      setNameError('Please enter your actual name rather than your User ID.');
      return;
    }

    try {
      setSavingName(true);
      setNameError('');
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          username: cleanName,
          updated_at: new Date().toISOString()
        })
        .eq('id', (user?.id || profile?.id));

      if (updateErr) throw updateErr;

      try {
        await supabase.auth.updateUser({
          data: { username: cleanName, full_name: cleanName }
        });
      } catch (e) {}

      updateProfile({
        ...profile,
        username: cleanName
      });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch (err) {
      setNameError(err.message || 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleColorClick = (colorName) => {
    setSelectedColor(colorName);
    applyTheme(colorName);
    setSaved(false);
  };

  const handleBgClick = (bgName) => {
    setSelectedBg(bgName);
    applyBackground(bgName);
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase.rpc('update_personal_settings', {
        p_theme_color: selectedColor,
        p_bg_color: selectedBg,
        p_personal_quote: quote.trim() || null
      });

      if (error) throw error;

      updateProfile({
        ...profile,
        theme_color: selectedColor,
        bg_color: selectedBg,
        personal_quote: quote.trim() || null
      });

      setSaved(true);
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pro-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pro-settings-modal">
        {/* Modal Top Bar */}
        <div className="pro-settings-top">
          <div className="pro-settings-top-title">
            <span className="pro-settings-icon">⚙️</span>
            <div>
              <h3>Workspace Preferences & Control Center</h3>
              <p>Personalize your environment, layout themes, and private workspace feed.</p>
            </div>
          </div>
          <button className="pro-settings-close-btn" onClick={onClose} title="Close Settings">
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="pro-settings-nav-tabs">
          <button
            type="button"
            className={`pro-settings-tab ${activeTab === 'appearance' ? 'pro-tab-active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            🎨 Themes & Appearance
          </button>
          <button
            type="button"
            className={`pro-settings-tab ${activeTab === 'profile' ? 'pro-tab-active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            💭 Personal Quote & Feed
          </button>
          <button
            type="button"
            className={`pro-settings-tab ${activeTab === 'profile_info' ? 'pro-tab-active' : ''}`}
            onClick={() => setActiveTab('profile_info')}
          >
            👤 Account Details
          </button>
          <button
            type="button"
            className={`pro-settings-tab ${activeTab === 'notifications' ? 'pro-tab-active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            🔔 Push Notifications
          </button>
        </div>

        {/* Tab Content */}
        <div className="pro-settings-body">
          {activeTab === 'appearance' && (
            <div className="pro-settings-section-group">
              {/* Accent Color Section */}
              <div className="pro-settings-block">
                <div className="pro-block-header">
                  <div>
                    <h4>Accent Brand Color</h4>
                    <p>Primary color for buttons, glowing tabs, active highlights, and badges.</p>
                  </div>
                  <span className="pro-selected-pill">{selectedColor}</span>
                </div>

                <div className="pro-color-grid">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`pro-color-swatch ${selectedColor === c.name ? 'pro-swatch-active' : ''}`}
                      onClick={() => handleColorClick(c.name)}
                      title={c.label}
                    >
                      <span className="pro-color-circle" style={{ backgroundColor: c.swatch }} />
                      <span className="pro-color-label">{c.label}</span>
                      {selectedColor === c.name && <span className="pro-check-mark">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Theme Section */}
              <div className="pro-settings-block">
                <div className="pro-block-header">
                  <div>
                    <h4>Atmospheric Background Theme</h4>
                    <p>Curated ergonomic dark palettes engineered for long collaborative sessions.</p>
                  </div>
                  <span className="pro-selected-pill">{selectedBg}</span>
                </div>

                <div className="pro-bg-grid">
                  {BG_OPTIONS.map((bg) => (
                    <button
                      key={bg.name}
                      type="button"
                      className={`pro-bg-card ${selectedBg === bg.name ? 'pro-bg-active' : ''}`}
                      onClick={() => handleBgClick(bg.name)}
                    >
                      <div className="pro-bg-preview" style={{ backgroundColor: bg.swatch }}>
                        <div className="pro-bg-inner-mock">
                          <span className="pro-mock-bar"></span>
                          <span className="pro-mock-card"></span>
                        </div>
                      </div>
                      <div className="pro-bg-info">
                        <div className="pro-bg-name">{bg.label}</div>
                        <div className="pro-bg-desc">{bg.desc}</div>
                      </div>
                      {selectedBg === bg.name && <span className="pro-bg-check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="pro-settings-section-group">
              <div className="pro-settings-block">
                <div className="pro-block-header">
                  <div>
                    <h4>Private Daily Motivational Quote</h4>
                    <p>Displays at the top of your dashboard. Strictly private — teammates cannot see your quote.</p>
                  </div>
                </div>

                <div className="pro-quote-input-wrapper">
                  <span className="pro-quote-mark">“</span>
                  <textarea
                    className="pro-quote-textarea"
                    placeholder="Enter your personal motto or inspiration (e.g. Focus on what moves the needle forward)..."
                    value={quote}
                    onChange={(e) => {
                      setQuote(e.target.value);
                      setSaved(false);
                    }}
                    rows={3}
                    maxLength={200}
                  />
                </div>
                <div className="pro-quote-char-count">
                  <span>{quote.length}/200 characters</span>
                </div>

                <div className="pro-quote-preview-box">
                  <span className="pro-preview-label">Live Dashboard Preview:</span>
                  <div className="personal-quote mt-1" style={{ margin: 0 }}>
                    <span className="quote-icon">💭</span>
                    <em>"{quote || 'Your personal quote will appear right here...'}"</em>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile_info' && (
            <div className="pro-settings-section-group">
              <div className="pro-settings-block">
                <div className="pro-block-header">
                  <div>
                    <h4>Verified Identity & Display Name</h4>
                    <p>Your official name is displayed in announcements, push notifications, and task assignments.</p>
                  </div>
                </div>

                {nameError && <div className="alert alert-error mb-2">{nameError}</div>}
                {nameSaved && <div className="alert alert-success mb-2">✅ Display name updated successfully!</div>}

                <form onSubmit={handleUpdateName} style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Full Name / Display Name:
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: '1 1 240px', background: 'rgba(15, 17, 30, 0.8)' }}
                      placeholder="e.g. Asutosh Mishra"
                      value={editableName}
                      onChange={(e) => setEditableName(e.target.value)}
                      maxLength={50}
                      required
                    />
                    <button
                      type="submit"
                      disabled={savingName || editableName.trim().length < 2 || editableName.trim() === profile?.username}
                      className="btn btn-primary"
                      style={{ padding: '8px 18px', whiteSpace: 'nowrap' }}
                    >
                      {savingName ? 'Saving...' : 'Update Name'}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    This name will appear on teammates' Android notifications like WhatsApp / Instagram.
                  </span>
                </form>

                <div className="pro-account-details-grid">
                  <div className="pro-account-field">
                    <label>Public User ID:</label>
                    <div className="pro-account-val monospace">{profile?.user_id || 'Generating...'}</div>
                  </div>
                  <div className="pro-account-field">
                    <label>Registered Email:</label>
                    <div className="pro-account-val">{profile?.email || 'Authenticated User'}</div>
                  </div>
                  <div className="pro-account-field">
                    <label>Active Display Name:</label>
                    <div className="pro-account-val" style={{ color: '#a5b4fc', fontWeight: 600 }}>{profile?.username || 'Not Set'}</div>
                  </div>
                  <div className="pro-account-field">
                    <label>Cloud Storage Bucket:</label>
                    <div className="pro-account-val">Cloud Storage Drive (Active)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="pro-settings-section-group">
              <div className="pro-settings-block">
                <div className="pro-block-header">
                  <div>
                    <h4>Android Push Notifications & System Alerts</h4>
                    <p>Configure closed-browser push delivery, multi-device sync, and category alerts.</p>
                  </div>
                </div>
                <NotificationPreferences />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pro-settings-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="pro-btn-save-settings"
          >
            {saving ? 'Applying Settings...' : saved ? '✅ Preferences Applied!' : 'Save & Apply Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}
