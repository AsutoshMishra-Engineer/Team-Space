-- ============================================================================
-- TEAM-SPACE: STEP 1 SECURITY HARDENING MIGRATION
-- Safe & Idempotent: Run this in Supabase Dashboard -> SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Schema Consistency & Profile Name Collision Fix
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bg_color text DEFAULT 'Dark';
ALTER TABLE public.team_files ADD COLUMN IF NOT EXISTS file_url text;

-- Allow multiple users to share the same real Full Name (user_id remains unique)
DROP INDEX IF EXISTS public.profiles_username_unique;

CREATE OR REPLACE FUNCTION public.update_profile_info(p_username text, p_avatar_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required.');
  END IF;

  IF p_username IS NULL OR char_length(trim(p_username)) < 2 THEN
    RETURN jsonb_build_object('error', 'Display name must be at least 2 characters.');
  END IF;

  UPDATE public.profiles
  SET username   = trim(p_username),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_profile_info(text, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. Profiles: Prevent Global PII Scraping & is_admin Privilege Escalation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shares_team_with(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm1
    JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = target_user_id
  );
$$;

DROP POLICY IF EXISTS "authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "users view own or teammate profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.shares_team_with(id)
  OR public.is_app_admin()
);

DROP POLICY IF EXISTS "users can update own profile OR admin" ON public.profiles;
CREATE POLICY "users can update own profile OR admin" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_app_admin())
WITH CHECK (id = auth.uid() OR public.is_app_admin());

-- Column-level protection trigger: non-admins can NEVER escalate is_admin or alter immutable IDs
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_app_admin() THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Permission denied: cannot modify admin privileges';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Permission denied: cannot modify immutable account identity fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- Minimal invite lookup RPC: returns ONLY (id, user_id), never email or is_admin
CREATE OR REPLACE FUNCTION public.lookup_user_for_invite(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_clean text;
  v_rec record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'Authentication required');
  END IF;

  v_clean := upper(trim(COALESCE(p_user_id, '')));
  IF v_clean = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'User ID is required');
  END IF;

  SELECT id, user_id INTO v_rec
  FROM public.profiles
  WHERE user_id = v_clean
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object('found', true, 'id', v_rec.id, 'user_id', v_rec.user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_user_for_invite(text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 3. Team Members: Block Self-Approval & Leader Hijacking + Atomic RPCs
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "update team members" ON public.team_members;
CREATE POLICY "update team members" ON public.team_members
FOR UPDATE TO authenticated
USING (public.is_team_leader(team_id) OR public.is_app_admin())
WITH CHECK (public.is_team_leader(team_id) OR public.is_app_admin());

-- Ensure existing join_team_by_code runs as SECURITY DEFINER if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'join_team_by_code' AND NOT p.prosecdef
  ) THEN
    ALTER FUNCTION public.join_team_by_code(text) SECURITY DEFINER SET search_path = public;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Atomic team creation (team + leader membership in one transaction)
CREATE OR REPLACE FUNCTION public.create_team_with_leader(
  p_name text,
  p_project_idea text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team public.teams%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF p_name IS NULL OR char_length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team name is required');
  END IF;

  INSERT INTO public.teams (name, project_idea, created_by)
  VALUES (trim(p_name), NULLIF(trim(COALESCE(p_project_idea, '')), ''), auth.uid())
  RETURNING * INTO v_team;

  INSERT INTO public.team_members (team_id, user_id, role, status)
  VALUES (v_team.id, auth.uid(), 'leader', 'active');

  RETURN jsonb_build_object('success', true, 'team', row_to_json(v_team));
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team_with_leader(text, text) TO authenticated;

-- Atomic leadership transfer
CREATE OR REPLACE FUNCTION public.transfer_team_leadership(
  p_team_id uuid,
  p_new_leader_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF NOT public.is_team_leader(p_team_id) AND NOT public.is_app_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the current team leader can transfer leadership');
  END IF;

  IF p_new_leader_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already the team leader');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_new_leader_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected user is not an active member of this team');
  END IF;

  UPDATE public.team_members
  SET role = 'leader'
  WHERE team_id = p_team_id AND user_id = p_new_leader_id;

  UPDATE public.team_members
  SET role = 'member'
  WHERE team_id = p_team_id AND user_id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_team_leadership(uuid, uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- 4. Push Subscriptions: Enforce Team Membership & Block Anonymous Dumping
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_team_push_subscriptions(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_subs jsonb;
BEGIN
  -- Allow service_role (Edge/Worker admin) or active team members only
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR (NOT public.is_team_member(p_team_id) AND NOT public.is_app_admin()) THEN
      RETURN '[]'::jsonb;
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'user_id', s.user_id,
      'subscription', s.subscription,
      'endpoint', s.endpoint,
      'device_type', s.device_type
    )
  ), '[]'::jsonb) INTO v_subs
  FROM public.user_push_subscriptions s
  WHERE s.team_id = p_team_id;

  RETURN v_subs;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_push_subscriptions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_push_subscriptions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_team_id uuid,
  p_subscription jsonb,
  p_device_type text DEFAULT 'android',
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_endpoint text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
  END IF;

  IF NOT public.is_team_member(p_team_id) AND NOT public.is_app_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: not an active member of this team');
  END IF;

  v_endpoint := p_subscription->>'endpoint';
  IF v_endpoint IS NULL OR v_endpoint = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing subscription endpoint');
  END IF;

  INSERT INTO public.user_push_subscriptions (
    user_id,
    team_id,
    subscription,
    endpoint,
    device_type,
    user_agent,
    updated_at
  ) VALUES (
    auth.uid(),
    p_team_id,
    p_subscription,
    v_endpoint,
    COALESCE(p_device_type, 'android'),
    p_user_agent,
    now()
  )
  ON CONFLICT (user_id, team_id, endpoint)
  DO UPDATE SET
    subscription = EXCLUDED.subscription,
    device_type = EXCLUDED.device_type,
    user_agent = EXCLUDED.user_agent,
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_push_subscription(uuid, jsonb, text, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 5. Smart Tasks & Activity Logs: Prevent Direct Status/Audit Spoofing
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "leaders and assignees update tasks" ON public.team_tasks;
CREATE POLICY "leaders update tasks directly" ON public.team_tasks
FOR UPDATE TO authenticated
USING (public.is_team_leader(team_id) OR public.is_app_admin())
WITH CHECK (public.is_team_leader(team_id) OR public.is_app_admin());

DROP POLICY IF EXISTS "team members insert task activity" ON public.task_activity_logs;
CREATE POLICY "team members insert task activity" ON public.task_activity_logs
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.team_tasks t
    WHERE t.id = task_activity_logs.task_id
      AND (public.is_team_member(t.team_id) OR public.is_app_admin())
  )
);

CREATE OR REPLACE FUNCTION public.transition_task_status(
  p_task_id uuid,
  p_new_status text,
  p_comment text DEFAULT NULL,
  p_submission_notes text DEFAULT NULL,
  p_submission_link text DEFAULT NULL,
  p_leader_feedback text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task record;
  v_is_leader boolean;
  v_is_member boolean;
  v_is_assignee boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF p_new_status NOT IN ('assigned', 'accepted', 'in_progress', 'review_pending', 'completed', 'changes_requested') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid task status');
  END IF;

  SELECT * INTO v_task FROM public.team_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;

  v_is_leader := public.is_team_leader(v_task.team_id) OR public.is_app_admin();
  v_is_member := public.is_team_member(v_task.team_id);
  v_is_assignee := (v_task.assigned_to = auth.uid() AND v_is_member);

  IF p_new_status IN ('completed', 'changes_requested') THEN
    IF NOT v_is_leader THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the team leader can approve or request changes on tasks');
    END IF;
  ELSIF p_new_status IN ('accepted', 'in_progress', 'review_pending') THEN
    IF NOT v_is_assignee AND NOT v_is_leader THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the active assigned member or team leader can update this task');
    END IF;
  ELSE
    IF NOT v_is_leader THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the team leader can reset task status');
    END IF;
  END IF;

  -- Reject non-http(s) submission links
  IF p_submission_link IS NOT NULL AND trim(p_submission_link) <> '' THEN
    IF p_submission_link !~* '^https?://' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Submission link must start with http:// or https://');
    END IF;
  END IF;

  UPDATE public.team_tasks
  SET 
    status = p_new_status,
    submission_notes = COALESCE(p_submission_notes, submission_notes),
    submission_link = COALESCE(p_submission_link, submission_link),
    leader_feedback = COALESCE(p_leader_feedback, leader_feedback),
    updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.task_activity_logs (
    task_id,
    user_id,
    old_status,
    new_status,
    comment
  ) VALUES (
    p_task_id,
    auth.uid(),
    v_task.status,
    p_new_status,
    COALESCE(p_comment, p_leader_feedback, p_submission_notes)
  );

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_task_status(uuid, text, text, text, text, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 6. Tighten Login Lookup Helpers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_email_by_user_id(p_user_id text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT email
  FROM public.profiles
  WHERE user_id = upper(trim(p_user_id))
    AND upper(trim(p_user_id)) ~ '^[0-9]{3}[A-Z]{2}[0-9]{2}$'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT user_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
$$;

NOTIFY pgrst, 'reload schema';
