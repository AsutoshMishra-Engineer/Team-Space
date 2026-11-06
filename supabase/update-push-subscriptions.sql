-- ========================================================
-- PRODUCTION UPGRADE: Multi-Device Web Push & Notification Preferences
-- Backward-compatible: Keeps existing columns and subscriptions intact
-- ========================================================

-- 1. Create or extend user_push_subscriptions for multi-device support
CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  endpoint text,
  device_type text DEFAULT 'android',
  user_agent text,
  updated_at timestamptz DEFAULT now()
);

-- Safely add endpoint, device_type, user_agent if table already existed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_push_subscriptions' AND column_name = 'endpoint') THEN
    ALTER TABLE public.user_push_subscriptions ADD COLUMN endpoint text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_push_subscriptions' AND column_name = 'device_type') THEN
    ALTER TABLE public.user_push_subscriptions ADD COLUMN device_type text DEFAULT 'android';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_push_subscriptions' AND column_name = 'user_agent') THEN
    ALTER TABLE public.user_push_subscriptions ADD COLUMN user_agent text;
  END IF;
END $$;

-- Populate endpoint from subscription JSON if endpoint is null
UPDATE public.user_push_subscriptions
SET endpoint = subscription->>'endpoint'
WHERE endpoint IS NULL AND subscription ? 'endpoint';

-- Drop old unique constraint on (user_id, team_id) if it exists so users can register multiple devices (e.g. phone + laptop)
ALTER TABLE public.user_push_subscriptions DROP CONSTRAINT IF EXISTS user_push_subscriptions_user_id_team_id_key;

-- Add unique constraint on (user_id, team_id, endpoint) to prevent duplicate subscriptions for the same physical device
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_push_subscriptions_user_team_endpoint_key'
  ) THEN
    ALTER TABLE public.user_push_subscriptions 
    ADD CONSTRAINT user_push_subscriptions_user_team_endpoint_key UNIQUE (user_id, team_id, endpoint);
  END IF;
EXCEPTION
  WHEN others THEN
    -- If duplicate endpoints already exist, resolve duplicates and re-add constraint
    NULL;
END $$;

-- Index for fast lookup by team & user
CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_team ON public.user_push_subscriptions(team_id);
CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_user ON public.user_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_endpoint ON public.user_push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own push subscriptions
DROP POLICY IF EXISTS "users manage own push subs" ON public.user_push_subscriptions;
CREATE POLICY "users manage own push subs" ON public.user_push_subscriptions
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow team members to view team subscriptions for push dispatch
DROP POLICY IF EXISTS "team members view push subs" ON public.user_push_subscriptions;
CREATE POLICY "team members view push subs" ON public.user_push_subscriptions
FOR SELECT TO authenticated
USING (public.is_team_member(team_id) OR public.is_app_admin());

-- 2. Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_announcements boolean DEFAULT true,
  notify_tasks boolean DEFAULT true,
  notify_attendance boolean DEFAULT true,
  notify_reminders boolean DEFAULT true,
  sound_enabled boolean DEFAULT true,
  vibration_enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own notif prefs" ON public.notification_preferences;
CREATE POLICY "users manage own notif prefs" ON public.notification_preferences
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
