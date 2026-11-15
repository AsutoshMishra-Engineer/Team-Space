import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldIcon, ChatIcon, FolderIcon, SparklesIcon, TasksIcon, SettingsIcon } from '../components/icons/Icons';

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="landing">
      {/* Hero */}
      <div className="hero-section">
        <div className="hero-badge" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
          ✨ Enterprise Team Collaboration &amp; Agile Execution Platform
        </div>
        <h1 className="landing-title">
          Your Team's<br />
          <span className="title-highlight">Command Center</span>
        </h1>
        <p className="landing-subtitle">
          Create private workspaces, collaborate in real-time, share files, and boost execution with native AI assistance —
          all in one unified platform.
        </p>
        <div className="landing-buttons">
          {user ? (
            <Link to="/workspace" className="btn btn-primary btn-hero">
              Open Workspace Dashboard →
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary btn-hero">
                Get Started Free
              </Link>
              <Link to="/login" className="btn btn-secondary btn-hero">
                Sign In
              </Link>
            </>
          )}
          <a
            href="https://github.com/AsutoshMishra-Engineer/Team-Space/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-hero"
            style={{ border: '1px solid rgba(255, 255, 255, 0.15)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            Download Android APK
          </a>
        </div>
        <p className="hero-note">No credit card needed · Free forever · Self-contained &amp; Private</p>
      </div>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-number">Private</div>
          <div className="stat-label">Secure Workspaces</div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className="stat-number">Real-Time</div>
          <div className="stat-label">Chat &amp; Sync</div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className="stat-number">AI Powered</div>
          <div className="stat-label">Built-in Assistant</div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <div className="stat-number">Private Files</div>
          <div className="stat-label">Signed Storage</div>
        </div>
      </div>

      {/* Features */}
      <div className="landing-features">
        <div className="feature-card">
          <div className="feature-icon-wrap" style={{ background: 'rgba(108,99,255,0.12)', color: 'var(--accent)' }}>
            <ShieldIcon size={22} />
          </div>
          <h3 className="feature-title">Private Teams</h3>
          <p className="feature-desc">
            Invite-only workspaces. Only approved members can access your team's space.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-wrap" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
            <ChatIcon size={22} />
          </div>
          <h3 className="feature-title">Real-time Chat</h3>
          <p className="feature-desc">
            Team chat, announcements, and updates — stay perfectly in sync.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-wrap" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            <FolderIcon size={22} />
          </div>
          <h3 className="feature-title">File Sharing</h3>
          <p className="feature-desc">
            Upload and share files with secure high-speed cloud storage.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-wrap" style={{ background: 'rgba(108,99,255,0.12)', color: 'var(--accent)' }}>
            <SparklesIcon size={22} />
          </div>
          <h3 className="feature-title">Native AI Assistant</h3>
          <p className="feature-desc">
            Proprietary TeamSpace technical intelligence — code analysis, system design, meeting summaries, and agile workflows.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-wrap" style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>
            <TasksIcon size={22} />
          </div>
          <h3 className="feature-title">Personal Todos</h3>
          <p className="feature-desc">
            Private to-do list with deadlines — only you can see it.
          </p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-wrap" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
            <SettingsIcon size={22} />
          </div>
          <h3 className="feature-title">Custom Themes</h3>
          <p className="feature-desc">
            Personalize your accent color and background — make it yours.
          </p>
        </div>
      </div>

      {/* CTA Bottom */}
      <div className="landing-cta">
        <h2 className="cta-title">Ready to level up your team?</h2>
        {user ? (
          <Link to="/workspace" className="btn btn-primary btn-hero">
            Open Your Workspace Dashboard →
          </Link>
        ) : (
          <Link to="/register" className="btn btn-primary btn-hero">
            Create Your First Team →
          </Link>
        )}
      </div>
    </div>
  );
}
