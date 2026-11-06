import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import PersonalSettings from '../components/PersonalSettings';
import PersonalTodos from '../components/PersonalTodos';
import GoogleSearchBar from '../components/GoogleSearchBar';
import { PageLoader } from '../components/Spinner';

export default function MyTeamsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchTeams = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_my_teams');

        if (error) throw error;
        setTeams(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [user]);

  if (loading) return <PageLoader text="Loading your teams..." />;

  return (
    <div>
      {/* Google Web Search Bar */}
      <div className="dashboard-search-container">
        <GoogleSearchBar />
      </div>

      {/* Personal Quote */}
      {profile?.personal_quote && (
        <div className="personal-quote">
          <span className="quote-icon">💭</span>
          <em>"{profile.personal_quote}"</em>
        </div>
      )}

      <div className="teams-header">
        <h1>My Teams</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)} className="btn btn-ghost btn-small" title="Personal Settings">
            ⚙️ Settings
          </button>
          <Link to="/workspace/create" className="btn btn-primary">+ Create a Team</Link>
          <Link to="/workspace/join" className="btn btn-secondary">Join a Team</Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-text">No teams yet</div>
          <p className="text-muted">Create a team or join one to get started</p>
        </div>
      ) : (
        <div className="teams-grid">
          {teams.map((t) => (
            <div
              key={t.id}
              className="team-card"
              onClick={() => navigate(`/workspace/team/${t.id}`)}
            >
              <div className="team-card-info">
                <div className="team-card-name">{t.name}</div>
                {t.project_idea && (
                  <div className="team-card-idea">
                    {t.project_idea.length > 100
                      ? t.project_idea.substring(0, 100) + '...'
                      : t.project_idea}
                  </div>
                )}
              </div>
              <span className={`badge badge-${t.role}`}>
                {t.role.charAt(0).toUpperCase() + t.role.slice(1)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Personal To-Do List */}
      <PersonalTodos teams={teams} />

      {/* Settings Modal */}
      {showSettings && <PersonalSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
