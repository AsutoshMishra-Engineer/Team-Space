-- Allow all team members to post announcements & extend deadlines
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. Drop existing restrictive policies on announcements
DROP POLICY IF EXISTS "insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "delete announcements" ON public.announcements;
DROP POLICY IF EXISTS "update announcements" ON public.announcements;

-- 2. Allow ANY team member or app admin to post announcements
CREATE POLICY "insert announcements" ON public.announcements
FOR INSERT TO authenticated
WITH CHECK (
  (public.is_team_member(team_id) OR public.is_app_admin())
  AND posted_by = auth.uid()
);

-- 3. Allow author, team leader, or app admin to update announcements (e.g. extend deadline)
CREATE POLICY "update announcements" ON public.announcements
FOR UPDATE TO authenticated
USING (
  posted_by = auth.uid()
  OR public.is_team_leader(team_id)
  OR public.is_app_admin()
);

-- 4. Allow author, team leader, or app admin to delete announcements
CREATE POLICY "delete announcements" ON public.announcements
FOR DELETE TO authenticated
USING (
  posted_by = auth.uid()
  OR public.is_team_leader(team_id)
  OR public.is_app_admin()
);

-- 5. RPC function: post_announcement (SECURITY DEFINER fallback)
CREATE OR REPLACE FUNCTION public.post_announcement(
  p_team_id uuid,
  p_message text,
  p_deadline date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_rec record;
BEGIN
  IF NOT public.is_team_member(p_team_id) AND NOT public.is_app_admin() THEN
    RETURN json_build_object('success', false, 'error', 'You must be a team member to post an announcement');
  END IF;

  IF p_deadline IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Deadline is compulsory for announcements');
  END IF;

  INSERT INTO public.announcements (team_id, posted_by, message, deadline)
  VALUES (p_team_id, auth.uid(), p_message, p_deadline)
  RETURNING * INTO v_rec;

  RETURN json_build_object('success', true, 'data', row_to_json(v_rec));
END;
$function$;

-- 6. RPC function: extend_announcement_deadline
CREATE OR REPLACE FUNCTION public.extend_announcement_deadline(
  p_announcement_id uuid,
  p_new_deadline date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_posted_by uuid;
  v_team_id uuid;
BEGIN
  SELECT posted_by, team_id INTO v_posted_by, v_team_id
  FROM public.announcements
  WHERE id = p_announcement_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Announcement not found');
  END IF;

  IF auth.uid() != v_posted_by AND NOT public.is_team_leader(v_team_id) AND NOT public.is_app_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Only the author or team leader can extend the deadline');
  END IF;

  UPDATE public.announcements
  SET deadline = p_new_deadline
  WHERE id = p_announcement_id;

  RETURN json_build_object('success', true);
END;
$function$;

-- 7. Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.post_announcement(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_announcement_deadline(uuid, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
