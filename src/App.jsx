import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import MyTeamsPage from './pages/MyTeamsPage';
import CreateTeamPage from './pages/CreateTeamPage';
import JoinTeamPage from './pages/JoinTeamPage';
import TeamWorkspacePage from './pages/TeamWorkspacePage';
import AIStudioPage from './pages/AIStudioPage';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07070f',
          color: '#eee',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#f87171', marginBottom: '0.5rem' }}>⚠️ App Encountered an Issue</h2>
          <p style={{ color: '#9090b8', maxWidth: '480px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {this.state.error?.message || 'Something went wrong while rendering.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/#/workspace';
              window.location.reload();
            }}
            className="btn btn-primary"
          >
            🔄 Reload Workspace
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="auth/callback" element={<AuthCallbackPage />} />
          
          <Route path="workspace" element={<ProtectedRoute><MyTeamsPage /></ProtectedRoute>} />
          <Route path="workspace/ai" element={<ProtectedRoute><AIStudioPage /></ProtectedRoute>} />
          <Route path="workspace/create" element={<ProtectedRoute><CreateTeamPage /></ProtectedRoute>} />
          <Route path="workspace/join" element={<ProtectedRoute><JoinTeamPage /></ProtectedRoute>} />
          <Route path="workspace/team/:teamId" element={<ProtectedRoute><TeamWorkspacePage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
