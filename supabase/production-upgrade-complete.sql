-- ========================================================
-- TEAM-SPACE: PRODUCTION UPGRADE COMPLETE MIGRATION
-- Combines:
-- 1. Multi-Device Push Subscriptions & Notification Preferences
-- 2. Announcement Acknowledgement System
-- 3. Smart Task Management System (6-State Workflow)
-- 4. Work Attendance & Contribution Tracking (Leader-Exclusive)
-- ========================================================

-- --------------------------------------------------------
-- PART 1: Multi-Device Push & Preferences
-- --------------------------------------------------------
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

UPDATE public.user_push_subscriptions
SET endpoint = subscription->>'endpoint'
WHERE endpoint IS NULL AND subscription ? 'endpoint';

ALTER TABLE public.user_push_subscriptions DROP CONSTRAINT IF EXISTS user_push_subscriptions_user_id_team_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_push_subscriptions_user_team_endpoint_key'
  ) THEN
    ALTER TABLE public.user_push_subscriptions 
    ADD CONSTRAINT user_push_subscriptions_user_team_endpoint_key UNIQUE (user_id, team_id, endpoint);
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_team ON public.user_push_subscriptions(team_id);
CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_user ON public.user_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_endpoint ON public.user_push_subscriptions(endpoint);

ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own push subs" ON public.user_push_subscriptions;
CREATE POLICY "users manage own push subs" ON public.user_push_subscriptions
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "team members view push subs" ON public.user_push_subscriptions;
CREATE POLICY "team members view push subs" ON public.user_push_subscriptions
FOR SELECT TO authenticated
USING (public.is_team_member(team_id) OR public.is_app_admin());

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


-- --------------------------------------------------------
-- PART 2: Announcement Acknowledgements
-- --------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'is_important') THEN
    ALTER TABLE public.announcements ADD COLUMN is_important boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'requires_ack') THEN
    ALTER TABLE public.announcements ADD COLUMN requires_ack boolean DEFAULT false;
  END IF;
END $$;

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

ALTER TABLE public.announcement_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team members view acknowledgements" ON public.announcement_acknowledgements;
CREATE POLICY "team members view acknowledgements" ON public.announcement_acknowledgements
FOR SELECT TO authenticated
USING (public.is_team_member(team_id) OR public.is_app_admin());

DROP POLICY IF EXISTS "members acknowledge announcements" ON public.announcement_acknowledgements;
CREATE POLICY "members acknowledge announcements" ON public.announcement_acknowledgements
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_team_member(team_id));

DROP POLICY IF EXISTS "leaders manage acknowledgements" ON public.announcement_acknowledgements;
CREATE POLICY "leaders manage acknowledgements" ON public.announcement_acknowledgements
FOR DELETE TO authenticated
USING (public.is_team_leader(team_id) OR public.is_app_admin());

CREATE OR REPLACE FUNCTION public.get_announcement_acknowledgements(p_announcement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_team_id uuid;
  v_result jsonb;
BEGIN
  SELECT team_id INTO v_team_id FROM public.announcements WHERE id = p_announcement_id;
  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Announcement not found');
  END IF;

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


-- --------------------------------------------------------
-- PART 3: Smart Task Management (6-State Workflow)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'in_progress', 'review_pending', 'completed', 'changes_requested')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  deadline timestamptz NOT NULL,
  submission_notes text,
  submission_link text,
  leader_feedback text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_tasks_team ON public.team_tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_assignee ON public.team_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_team_tasks_status ON public.team_tasks(status);
CREATE INDEX IF NOT EXISTS idx_team_tasks_deadline ON public.team_tasks(deadline);

CREATE TABLE IF NOT EXISTS public.task_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean DEFAULT false,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_checklists_task ON public.task_checklists(task_id);

CREATE TABLE IF NOT EXISTS public.task_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  old_status text,
  new_status text,
  comment text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task ON public.task_activity_logs(task_id, created_at DESC);

ALTER TABLE public.team_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team members view team tasks" ON public.team_tasks;
CREATE POLICY "team members view team tasks" ON public.team_tasks
FOR SELECT TO authenticated
USING (public.is_team_member(team_id) OR public.is_app_admin());

DROP POLICY IF EXISTS "leaders create team tasks" ON public.team_tasks;
CREATE POLICY "leaders create team tasks" ON public.team_tasks
FOR INSERT TO authenticated
WITH CHECK (public.is_team_leader(team_id) OR public.is_app_admin());

DROP POLICY IF EXISTS "leaders and assignees update tasks" ON public.team_tasks;
CREATE POLICY "leaders and assignees update tasks" ON public.team_tasks
FOR UPDATE TO authenticated
USING (
  public.is_team_leader(team_id) OR 
  (public.is_team_member(team_id) AND assigned_to = auth.uid()) OR 
  public.is_app_admin()
);

DROP POLICY IF EXISTS "leaders delete team tasks" ON public.team_tasks;
CREATE POLICY "leaders delete team tasks" ON public.team_tasks
FOR DELETE TO authenticated
USING (public.is_team_leader(team_id) OR public.is_app_admin());

DROP POLICY IF EXISTS "team members view task checklists" ON public.task_checklists;
CREATE POLICY "team members view task checklists" ON public.task_checklists
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_tasks t 
    WHERE t.id = task_checklists.task_id AND (public.is_team_member(t.team_id) OR public.is_app_admin())
  )
);

DROP POLICY IF EXISTS "team members update task checklists" ON public.task_checklists;
CREATE POLICY "team members update task checklists" ON public.task_checklists
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_tasks t 
    WHERE t.id = task_checklists.task_id AND (public.is_team_member(t.team_id) OR public.is_app_admin())
  )
);

DROP POLICY IF EXISTS "team members view task activity" ON public.task_activity_logs;
CREATE POLICY "team members view task activity" ON public.task_activity_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_tasks t 
    WHERE t.id = task_activity_logs.task_id AND (public.is_team_member(t.team_id) OR public.is_app_admin())
  )
);

DROP POLICY IF EXISTS "team members insert task activity" ON public.task_activity_logs;
CREATE POLICY "team members insert task activity" ON public.task_activity_logs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

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
  v_is_assignee boolean;
BEGIN
  SELECT * INTO v_task FROM public.team_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;

  v_is_leader := public.is_team_leader(v_task.team_id) OR public.is_app_admin();
  v_is_assignee := (v_task.assigned_to = auth.uid());

  IF p_new_status IN ('completed', 'changes_requested') THEN
    IF NOT v_is_leader THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the team leader can approve or request changes on tasks');
    END IF;
  ELSIF p_new_status IN ('accepted', 'in_progress', 'review_pending') THEN
    IF NOT v_is_assignee AND NOT v_is_leader THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the assigned member or team leader can update this task');
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


-- --------------------------------------------------------
-- PART 4: Leader-Controlled Work Attendance & Audit Tracking
-- --------------------------------------------------------
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

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_logs ENABLE ROW LEVEL SECURITY;

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
  IF NOT public.is_team_leader(p_team_id) AND NOT public.is_app_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team leaders can record or modify attendance');
  END IF;

  SELECT * INTO v_existing FROM public.work_attendance 
  WHERE session_id = p_session_id AND user_id = p_user_id;

  IF FOUND THEN
    UPDATE public.work_attendance
    SET 
      status = p_status,
      contribution_notes = p_contribution_notes,
      marked_by = auth.uid(),
      marked_at = now()
    WHERE id = v_existing.id;

    v_attendance_id := v_existing.id;

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

  SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.session_date DESC), '[]'::jsonb) INTO v_sessions
  FROM public.attendance_sessions s
  WHERE s.team_id = p_team_id;

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

-- --------------------------------------------------------
-- Push Subscriptions RPC (Security Definer for Push Dispatch)
-- --------------------------------------------------------
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
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'user_id', s.user_id,
      'subscription', s.subscription,
      'endpoint', s.endpoint
    )
  ), '[]'::jsonb) INTO v_subs
  FROM public.user_push_subscriptions s
  WHERE s.team_id = p_team_id;

  RETURN v_subs;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_push_subscriptions(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Safe RPC helper for saving push subscriptions
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

  v_endpoint := p_subscription->>'endpoint';

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
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_push_subscription(uuid, jsonb, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
