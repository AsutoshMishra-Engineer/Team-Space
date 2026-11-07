import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function WorkspaceSearchBar({ searchQuery, setSearchQuery, onOpenSettings }) {
  const inputRef = useRef(null);

  // Global Ctrl+K / Cmd+K shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="workspace-command-bar">
      <div className="workspace-search-box">
        <span className="workspace-search-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="text"
          className="workspace-search-input"
          placeholder="Filter your teams, project ideas, or press Ctrl+K..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
        />

        {searchQuery && (
          <button
            type="button"
            className="workspace-search-clear"
            onClick={() => setSearchQuery('')}
            title="Clear Search"
          >
            ✕
          </button>
        )}

        <div className="workspace-search-shortcut" title="Press Ctrl+K to search">
          <kbd>Ctrl</kbd>+<kbd>K</kbd>
        </div>
      </div>

      {/* Quick Action Navigation Pills */}
      <div className="workspace-quick-actions">
        <Link to="/workspace/create" className="quick-action-pill" title="Create a new team workspace">
          <span>+</span> Create Team
        </Link>
        <Link to="/workspace/join" className="quick-action-pill" title="Join team by invite code">
          <span>🔑</span> Join Team
        </Link>
        <Link to="/workspace/ai" className="quick-action-pill" title="Open TeamSpace AI Work Studio">
          <span>⚡</span> AI Studio
        </Link>
        {onOpenSettings && (
          <button type="button" onClick={onOpenSettings} className="quick-action-pill" title="Open Workspace Preferences">
            <span>⚙️</span> Preferences
          </button>
        )}
      </div>
    </div>
  );
}
