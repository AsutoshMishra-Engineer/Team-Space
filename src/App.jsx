import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageLoader } from './components/Spinner';

// Route-level code splitting for lightning-fast mobile & web performance
const LandingPage = lazy(() => import('./pages/LandingPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const MyTeamsPage = lazy(() => import('./pages/MyTeamsPage'));
const CreateTeamPage = lazy(() => import('./pages/CreateTeamPage'));
const JoinTeamPage = lazy(() => import('./pages/JoinTeamPage'));
const TeamWorkspacePage = lazy(() => import('./pages/TeamWorkspacePage'));
const AIStudioPage = lazy(() => import('./pages/AIStudioPage'));

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
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="btn btn-primary"
            >
              🔄 Reload & Reconnect
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/#/workspace';
                window.location.reload();
              }}
              className="btn btn-ghost"
              style={{ background: 'rgba(255, 255, 255, 0.08)' }}
            >
              ← Back to My Teams
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader text="Loading TeamSpace..." />}>
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
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
