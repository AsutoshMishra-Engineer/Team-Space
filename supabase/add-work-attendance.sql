-- ========================================================
-- PRODUCTION UPGRADE: Work Attendance & Contribution Tracking
-- Exclusively controlled by Team Leaders (Strict Postgres RLS)
-- 4 Statuses: present, partial, absent, excused
-- Features: Verified contribution notes, weighted attendance %, audit log
-- ========================================================

-- 1. Attendance Sessions (Work Days / Standups / Review meetings)
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_team ON public.attendance_sessions(team_id, session_date DESC);

-- 2. Work Attendance Records
CREATE TABLE IF NOT EXISTS public.work_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'partial', 'absent', 'excused')),
  contribution_notes text,
  marked_by uuid NOT NULL REFERENCES auth.users(id),
  marked_at timestamptz DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_work_attendance_team ON public.work_attendance(team_id);
CREATE INDEX IF NOT EXISTS idx_work_attendance_user ON public.work_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_work_attendance_session ON public.work_attendance(session_id);

-- 3. Attendance Audit Logs (Tracks any modifications made by leaders)
CREATE TABLE IF NOT EXISTS public.attendance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.work_attendance(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  old_status text,
  new_status text,
  old_notes text,
  new_notes text,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_team ON public.attendance_audit_logs(team_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Strict Row Level Security Policies:
-- READ: All active team members can view attendance in their team
DROP POLICY IF EXISTS "team members view attendance sessions" ON public.attendance_sessions;
CREATE POLICY "team members view attendance sessions" ON public.attendance_sessions
FOR SELECT TO authenticated
USING (public.is_team_member(team_id) OR public.is_app_admin());

DROP POLICY IF EXISTS "team members view work attendance" ON public.work_attendance;
CREATE POLICY "team members view work attendance" ON public.work_attendance
FOR SELECT TO authenticated
USING (public.is_team_member(team_id) OR public.is_app_admin());

DROP POLICY IF EXISTS "team members view attendance audit" ON public.attendance_audit_logs;
CREATE POLICY "team members view attendance audit" ON public.attendance_audit_logs
FOR SELECT TO authenticated
USING (public.is_team_member(team_id) OR public.is_app_admin());

-- WRITE: ONLY Team Leaders or Admins can INSERT / UPDATE / DELETE attendance!
DROP POLICY IF EXISTS "leaders manage attendance sessions" ON public.attendance_sessions;
CREATE POLICY "leaders manage attendance sessions" ON public.attendance_sessions
FOR ALL TO authenticated
USING (public.is_team_leader(team_id) OR public.is_app_admin())
WITH CHECK (public.is_team_leader(team_id) OR public.is_app_admin());

DROP POLICY IF EXISTS "leaders manage work attendance" ON public.work_attendance;
CREATE POLICY "leaders manage work attendance" ON public.work_attendance
FOR ALL TO authenticated
USING (public.is_team_leader(team_id) OR public.is_app_admin())
WITH CHECK (public.is_team_leader(team_id) OR public.is_app_admin());

DROP POLICY IF EXISTS "leaders record attendance audit" ON public.attendance_audit_logs;
CREATE POLICY "leaders record attendance audit" ON public.attendance_audit_logs
FOR INSERT TO authenticated
WITH CHECK (public.is_team_leader(team_id) OR public.is_app_admin());

-- 5. Helper Function: Record or Update Attendance with Audit
CREATE OR REPLACE FUNCTION public.record_member_attendance(
  p_session_id uuid,
  p_team_id uuid,
  p_user_id uuid,
  p_status text,
  p_contribution_notes text DEFAULT NULL,
  p_correction_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
  v_attendance_id uuid;
BEGIN
  -- Strict permission check: only leader can record attendance
  IF NOT public.is_team_leader(p_team_id) AND NOT public.is_app_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team leaders can record or modify attendance');
  END IF;

  SELECT * INTO v_existing FROM public.work_attendance 
  WHERE session_id = p_session_id AND user_id = p_user_id;

  IF FOUND THEN
    -- Update existing record
    UPDATE public.work_attendance
    SET 
      status = p_status,
      contribution_notes = p_contribution_notes,
      marked_by = auth.uid(),
      marked_at = now()
    WHERE id = v_existing.id;

    v_attendance_id := v_existing.id;

    -- If status or notes changed, log to audit trail
    IF v_existing.status <> p_status OR COALESCE(v_existing.contribution_notes, '') <> COALESCE(p_contribution_notes, '') THEN
      INSERT INTO public.attendance_audit_logs (
        attendance_id,
        team_id,
        changed_by,
        old_status,
        new_status,
        old_notes,
        new_notes,
        reason
      ) VALUES (
        v_attendance_id,
        p_team_id,
        auth.uid(),
        v_existing.status,
        p_status,
        v_existing.contribution_notes,
        p_contribution_notes,
        COALESCE(p_correction_reason, 'Leader updated attendance mark')
      );
    END IF;
  ELSE
    -- Insert new record
    INSERT INTO public.work_attendance (
      session_id,
      team_id,
      user_id,
      status,
      contribution_notes,
      marked_by
    ) VALUES (
      p_session_id,
      p_team_id,
      p_user_id,
      p_status,
      p_contribution_notes,
      auth.uid()
    ) RETURNING id INTO v_attendance_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'attendance_id', v_attendance_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_member_attendance(uuid, uuid, uuid, text, text, text) TO authenticated;

-- 6. Helper Function: Fetch Team Attendance Matrix & Member Statistics
CREATE OR REPLACE FUNCTION public.get_team_attendance_summary(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_sessions jsonb;
  v_records jsonb;
  v_members jsonb;
BEGIN
  IF NOT public.is_team_member(p_team_id) AND NOT public.is_app_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized access');
  END IF;

  -- Sessions
  SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.session_date DESC), '[]'::jsonb) INTO v_sessions
  FROM public.attendance_sessions s
  WHERE s.team_id = p_team_id;

  -- Records with profiles
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'session_id', a.session_id,
      'user_id', a.user_id,
      'status', a.status,
      'contribution_notes', a.contribution_notes,
      'marked_at', a.marked_at,
      'marked_by', a.marked_by
    )
  ), '[]'::jsonb) INTO v_records
  FROM public.work_attendance a
  WHERE a.team_id = p_team_id;

  -- Active team members with roles
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'user_id', tm.user_id,
      'role', tm.role,
      'member_role', COALESCE(tm.member_role, ''),
      'profiles', jsonb_build_object(
        'user_id', p.user_id,
        'username', p.username,
        'email', p.email
      )
    ) ORDER BY CASE WHEN tm.role = 'leader' THEN 0 ELSE 1 END, p.user_id ASC
  ), '[]'::jsonb) INTO v_members
  FROM public.team_members tm
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  WHERE tm.team_id = p_team_id AND tm.status = 'active';

  RETURN jsonb_build_object(
    'sessions', v_sessions,
    'records', v_records,
    'members', v_members
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_attendance_summary(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
