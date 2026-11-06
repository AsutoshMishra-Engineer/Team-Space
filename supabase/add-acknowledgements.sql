-- ========================================================
-- PRODUCTION UPGRADE: Announcement Acknowledgement System
-- Backward-compatible: Safely extends announcements and adds acknowledgements table
-- ========================================================

-- 1. Extend announcements table with important & acknowledgement flags
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'is_important') THEN
    ALTER TABLE public.announcements ADD COLUMN is_important boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'requires_ack') THEN
    ALTER TABLE public.announcements ADD COLUMN requires_ack boolean DEFAULT false;
  END IF;
END $$;

-- 2. Create announcement_acknowledgements table
CREATE TABLE IF NOT EXISTS public.announcement_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ann_ack_announcement ON public.announcement_acknowledgements(announcement_id);
CREATE INDEX IF NOT EXISTS idx_ann_ack_team ON public.announcement_acknowledgements(team_id);
CREATE INDEX IF NOT EXISTS idx_ann_ack_user ON public.announcement_acknowledgements(user_id);

-- Enable RLS
ALTER TABLE public.announcement_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Allow team members to view acknowledgements in their teams
DROP POLICY IF EXISTS "team members view acknowledgements" ON public.announcement_acknowledgements;
CREATE POLICY "team members view acknowledgements" ON public.announcement_acknowledgements
FOR SELECT TO authenticated
USING (public.is_team_member(team_id) OR public.is_app_admin());

-- Allow active team members to acknowledge announcements for themselves
DROP POLICY IF EXISTS "members acknowledge announcements" ON public.announcement_acknowledgements;
CREATE POLICY "members acknowledge announcements" ON public.announcement_acknowledgements
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND 
  public.is_team_member(team_id)
);

-- Allow leaders to manage/reset if needed
DROP POLICY IF EXISTS "leaders manage acknowledgements" ON public.announcement_acknowledgements;
CREATE POLICY "leaders manage acknowledgements" ON public.announcement_acknowledgements
FOR DELETE TO authenticated
USING (public.is_team_leader(team_id) OR public.is_app_admin());

-- 3. Helper RPC to fetch acknowledgements summary with profile details
CREATE OR REPLACE FUNCTION public.get_announcement_acknowledgements(p_announcement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_team_id uuid;
  v_is_member boolean;
  v_result jsonb;
BEGIN
  -- Get team_id
  SELECT team_id INTO v_team_id FROM public.announcements WHERE id = p_announcement_id;
  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Announcement not found');
  END IF;

  -- Ensure caller is member or admin
  IF NOT public.is_team_member(v_team_id) AND NOT public.is_app_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized access');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'user_id', a.user_id,
      'acknowledged_at', a.acknowledged_at,
      'profiles', jsonb_build_object(
        'user_id', p.user_id,
        'username', p.username,
        'email', p.email
      ),
      'member_role', COALESCE(tm.member_role, '')
    )
  ), '[]'::jsonb) INTO v_result
  FROM public.announcement_acknowledgements a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN public.team_members tm ON tm.team_id = a.team_id AND tm.user_id = a.user_id
  WHERE a.announcement_id = p_announcement_id;

  RETURN jsonb_build_object('acknowledgements', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_announcement_acknowledgements(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
