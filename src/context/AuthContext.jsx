import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const THEME_COLORS = {
  Black:  { accent: '#6C63FF', accentLight: 'rgba(108, 99, 255, 0.15)', accentHover: '#5a52e0' },
  White:  { accent: '#94a3b8', accentLight: 'rgba(148, 163, 184, 0.1)', accentHover: '#cbd5e1' },
  Yellow: { accent: '#fbbf24', accentLight: 'rgba(251, 191, 36, 0.1)', accentHover: '#f59e0b' },
  Blue:   { accent: '#3b82f6', accentLight: 'rgba(59, 130, 246, 0.1)', accentHover: '#2563eb' },
  Green:  { accent: '#34d399', accentLight: 'rgba(52, 211, 153, 0.1)', accentHover: '#10b981' },
  Pink:   { accent: '#f472b6', accentLight: 'rgba(244, 114, 182, 0.1)', accentHover: '#ec4899' },
  Brown:  { accent: '#d97706', accentLight: 'rgba(217, 119, 6, 0.1)', accentHover: '#b45309' },
};

const BG_THEMES = {
  Dark:      { primary: '#0a0a0f', secondary: '#12121a', card: '#1a1a2e', cardHover: '#22223a', input: '#16162a', border: '#2a2a4a' },
  Navy:      { primary: '#0a1225', secondary: '#0f1a35', card: '#152244', cardHover: '#1c2d55', input: '#0d1630', border: '#1e3060' },
  Forest:    { primary: '#081208', secondary: '#0f1e0f', card: '#1a2e1a', cardHover: '#243a24', input: '#0d1a0d', border: '#2a4a2a' },
  Wine:      { primary: '#150a10', secondary: '#201018', card: '#2e1a24', cardHover: '#3a2230', input: '#1a0d14', border: '#4a2a3a' },
  Midnight:  { primary: '#08081e', secondary: '#10102e', card: '#1a1a40', cardHover: '#24244e', input: '#0d0d28', border: '#2a2a5a' },
  Charcoal:  { primary: '#111111', secondary: '#1a1a1a', card: '#252525', cardHover: '#303030', input: '#1e1e1e', border: '#3a3a3a' },
  Coffee:    { primary: '#140e08', secondary: '#1e1610', card: '#2e221a', cardHover: '#3a2e24', input: '#1a140d', border: '#4a3a2a' },
};

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyTheme = (colorName) => {
    const theme = THEME_COLORS[colorName] || THEME_COLORS.Black;
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--accent-light', theme.accentLight);
    document.documentElement.style.setProperty('--accent-hover', theme.accentHover);
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
