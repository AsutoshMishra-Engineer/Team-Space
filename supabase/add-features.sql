-- ============================================
-- FEATURE 1: Personal Settings (theme + quote)
-- ============================================

-- Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_color text DEFAULT 'Black';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personal_quote text;

-- Function to update personal settings
CREATE OR REPLACE FUNCTION public.update_personal_settings(p_theme_color text, p_personal_quote text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.profiles 
  SET theme_color = p_theme_color, 
      personal_quote = p_personal_quote, 
      updated_at = now()
  WHERE id = auth.uid();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_personal_settings(text, text) TO authenticated;

-- ============================================
-- FEATURE 2: Personal To-Do List
-- ============================================

CREATE TABLE IF NOT EXISTS public.personal_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_text text NOT NULL,
  due_date date,
  linked_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  is_done boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_todos_user ON public.personal_todos(user_id, is_done, created_at);

ALTER TABLE public.personal_todos ENABLE ROW LEVEL SECURITY;

-- Strict RLS: users can ONLY access their OWN todos
CREATE POLICY "Users can view own todos" ON public.personal_todos 
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own todos" ON public.personal_todos 
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own todos" ON public.personal_todos 
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own todos" ON public.personal_todos 
  FOR DELETE TO authenticated USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
