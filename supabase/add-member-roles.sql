-- ============================================
-- Add Custom Member Roles to Team Members
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================

-- 1. Add member_role column to team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS member_role text;

-- 2. Update get_team_data to include member_role in the returned member list
CREATE OR REPLACE FUNCTION public.get_team_data(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $function$
DECLARE
  v_team jsonb;
  v_members jsonb;
  v_is_member boolean;
BEGIN
  -- Verify requesting user is an active member
  SELECT EXISTS(
    SELECT 1 FROM public.team_members 
    WHERE team_id = p_team_id AND user_id = auth.uid() AND status = 'active'
  ) INTO v_is_member;
  
  IF NOT v_is_member AND NOT public.is_app_admin() THEN
    RETURN jsonb_build_object('error', 'You are not an active member of this team.');
  END IF;

  SELECT row_to_json(t)::jsonb INTO v_team
  FROM (SELECT * FROM public.teams WHERE id = p_team_id) t;

  SELECT COALESCE(jsonb_agg(row_to_json(m)), '[]'::jsonb) INTO v_members
  FROM (
    SELECT 
      tm.id, 
      tm.team_id, 
      tm.user_id, 
      tm.role, 
      tm.status, 
      tm.created_at,
      COALESCE(tm.member_role, '') as member_role,
      jsonb_build_object('user_id', p.user_id, 'email', p.email, 'username', p.username) as profiles
    FROM public.team_members tm
    LEFT JOIN public.profiles p ON p.id = tm.user_id
    WHERE tm.team_id = p_team_id
    ORDER BY 
      CASE WHEN tm.role = 'leader' THEN 0 ELSE 1 END,
      tm.created_at ASC
  ) m;

  RETURN jsonb_build_object('team', v_team, 'members', v_members);
END;
$function$;

-- 3. Secure function allowing Team Leader to set/update roles for team members
CREATE OR REPLACE FUNCTION public.set_member_role(
  p_team_id uuid,
  p_user_id uuid,
  p_role_title text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only leader or admin can assign member roles
  IF NOT public.is_team_leader(p_team_id) AND NOT public.is_app_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Only the team leader can assign roles to members');
  END IF;

  UPDATE public.team_members
  SET member_role = TRIM(p_role_title)
  WHERE team_id = p_team_id AND user_id = p_user_id;

  RETURN json_build_object('success', true);
END;
$function$;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.get_team_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) TO authenticated;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
