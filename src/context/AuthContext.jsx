import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const THEME_COLORS = {
  // Direct names from PersonalSettings.jsx
  Indigo:  { accent: '#6366f1', accentLight: 'rgba(99, 102, 241, 0.16)', accentHover: '#4f46e5', glow: 'rgba(99, 102, 241, 0.3)' },
  Emerald: { accent: '#10b981', accentLight: 'rgba(16, 185, 129, 0.16)', accentHover: '#059669', glow: 'rgba(16, 185, 129, 0.3)' },
  Sky:     { accent: '#0ea5e9', accentLight: 'rgba(14, 165, 233, 0.16)', accentHover: '#0284c7', glow: 'rgba(14, 165, 233, 0.3)' },
  Amber:   { accent: '#f59e0b', accentLight: 'rgba(245, 158, 11, 0.16)', accentHover: '#d97706', glow: 'rgba(245, 158, 11, 0.3)' },
  Rose:    { accent: '#f43f5e', accentLight: 'rgba(244, 63, 94, 0.16)',  accentHover: '#e11d48', glow: 'rgba(244, 63, 94, 0.3)' },
  Violet:  { accent: '#8b5cf6', accentLight: 'rgba(139, 92, 246, 0.16)', accentHover: '#7c3aed', glow: 'rgba(139, 92, 246, 0.3)' },
  Slate:   { accent: '#94a3b8', accentLight: 'rgba(148, 163, 184, 0.16)', accentHover: '#64748b', glow: 'rgba(148, 163, 184, 0.3)' },

  // Backward compatibility with previous database profiles
  Black:   { accent: '#6366f1', accentLight: 'rgba(99, 102, 241, 0.16)', accentHover: '#4f46e5', glow: 'rgba(99, 102, 241, 0.3)' },
  White:   { accent: '#94a3b8', accentLight: 'rgba(148, 163, 184, 0.16)', accentHover: '#64748b', glow: 'rgba(148, 163, 184, 0.3)' },
  Yellow:  { accent: '#f59e0b', accentLight: 'rgba(245, 158, 11, 0.16)', accentHover: '#d97706', glow: 'rgba(245, 158, 11, 0.3)' },
  Blue:    { accent: '#0ea5e9', accentLight: 'rgba(14, 165, 233, 0.16)', accentHover: '#0284c7', glow: 'rgba(14, 165, 233, 0.3)' },
  Green:   { accent: '#10b981', accentLight: 'rgba(16, 185, 129, 0.16)', accentHover: '#059669', glow: 'rgba(16, 185, 129, 0.3)' },
  Pink:    { accent: '#f43f5e', accentLight: 'rgba(244, 63, 94, 0.16)',  accentHover: '#e11d48', glow: 'rgba(244, 63, 94, 0.3)' },
  Brown:   { accent: '#d97706', accentLight: 'rgba(217, 119, 6, 0.16)',  accentHover: '#b45309', glow: 'rgba(217, 119, 6, 0.3)' },
};

const BG_THEMES = {
  Dark:      { primary: '#09090e', secondary: '#0e0e15', card: '#13131d', cardHover: '#191926', input: '#0c0c13', border: 'rgba(255, 255, 255, 0.08)' },
  Navy:      { primary: '#060d1a', secondary: '#0b162c', card: '#0f1f3d', cardHover: '#162b54', input: '#0a1426', border: 'rgba(56, 189, 248, 0.15)' },
  Forest:    { primary: '#051009', secondary: '#0a1d12', card: '#0e291a', cardHover: '#143824', input: '#08170e', border: 'rgba(34, 197, 94, 0.15)' },
  Wine:      { primary: '#13060c', secondary: '#1e0a13', card: '#2b0f1b', cardHover: '#381423', input: '#15070d', border: 'rgba(244, 63, 94, 0.15)' },
  Midnight:  { primary: '#060614', secondary: '#0b0b24', card: '#111136', cardHover: '#171747', input: '#09091d', border: 'rgba(129, 140, 248, 0.15)' },
  Charcoal:  { primary: '#0b0b0d', secondary: '#111115', card: '#16161b', cardHover: '#1d1d24', input: '#0d0d10', border: 'rgba(255, 255, 255, 0.08)' },
  Coffee:    { primary: '#110b07', secondary: '#1b120c', card: '#261911', cardHover: '#322117', input: '#140d08', border: 'rgba(217, 119, 6, 0.15)' },
};

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyTheme = (colorName) => {
    const theme = THEME_COLORS[colorName] || THEME_COLORS.Indigo || THEME_COLORS.Black;
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--accent-light', theme.accentLight);
    document.documentElement.style.setProperty('--accent-hover', theme.accentHover);
    document.documentElement.style.setProperty('--accent-glow', theme.glow || 'rgba(99, 102, 241, 0.3)');
  };

  const applyBackground = (bgName) => {
    const bg = BG_THEMES[bgName] || BG_THEMES.Dark;
    document.documentElement.style.setProperty('--bg-primary', bg.primary);
    document.documentElement.style.setProperty('--bg-secondary', bg.secondary);
    document.documentElement.style.setProperty('--bg-card', bg.card);
    document.documentElement.style.setProperty('--bg-card-hover', bg.cardHover);
    document.documentElement.style.setProperty('--bg-input', bg.input);
    document.documentElement.style.setProperty('--border', bg.border);
  };

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        } else {
          setProfile(null);
          applyTheme('Black');
          applyBackground('Dark');
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
        if (data?.theme_color) applyTheme(data.theme_color);
        if (data?.bg_color) applyBackground(data.bg_color);
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
    }
  };

  const updateProfile = (newProfile) => {
    setProfile(newProfile);
    if (newProfile?.theme_color) applyTheme(newProfile.theme_color);
    if (newProfile?.bg_color) applyBackground(newProfile.bg_color);
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      applyTheme('Black');
      applyBackground('Dark');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, updateProfile, applyTheme, applyBackground, THEME_COLORS, BG_THEMES }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
