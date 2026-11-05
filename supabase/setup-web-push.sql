-- Create Push Subscriptions Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, team_id)
);

-- Index for fast lookup by team
CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_team ON public.user_push_subscriptions(team_id);

-- Enable RLS
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own push subscriptions
DROP POLICY IF EXISTS "users manage own push subs" ON public.user_push_subscriptions;
CREATE POLICY "users manage own push subs" ON public.user_push_subscriptions
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow team members to read subscriptions of teammates for dispatch
DROP POLICY IF EXISTS "team members view push subs" ON public.user_push_subscriptions;
CREATE POLICY "team members view push subs" ON public.user_push_subscriptions
FOR SELECT TO authenticated
USING (public.is_team_member(team_id) OR public.is_app_admin());
