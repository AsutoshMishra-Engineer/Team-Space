-- ============================================
-- FIX 1: Add foreign key relationships to profiles
-- This fixes "Could not find a relationship" error
-- ============================================

-- team_members → profiles
ALTER TABLE public.team_members 
  ADD CONSTRAINT team_members_profiles_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- announcements → profiles
ALTER TABLE public.announcements 
  ADD CONSTRAINT announcements_profiles_fkey 
  FOREIGN KEY (posted_by) REFERENCES public.profiles(id);

-- chat_messages → profiles
ALTER TABLE public.chat_messages 
  ADD CONSTRAINT chat_messages_profiles_fkey 
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id);

-- team_files → profiles
ALTER TABLE public.team_files 
  ADD CONSTRAINT team_files_profiles_fkey 
  FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);

-- ============================================
-- FIX 2: Functions for User ID login (works without authentication)
-- This fixes "can't login with User ID" problem
-- ============================================

-- Lookup email by User ID (used for login)
CREATE OR REPLACE FUNCTION public.get_email_by_user_id(p_user_id text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT email FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Lookup User ID by email (used for "Forgot User ID")
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT user_id FROM public.profiles WHERE email = p_email LIMIT 1;
$$;

-- Allow these functions to be called by anyone (including non-logged-in users)
GRANT EXECUTE ON FUNCTION public.get_email_by_user_id(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO anon, authenticated;

-- ============================================
-- Reload PostgREST schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';
