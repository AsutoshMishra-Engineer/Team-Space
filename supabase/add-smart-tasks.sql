-- ========================================================
-- PRODUCTION UPGRADE: Smart Task Management System
-- 6-State Lifecycle: assigned -> accepted -> in_progress -> review_pending -> completed | changes_requested
-- Fully collaborative & team-based. Preserves personal_todos intact!
-- ========================================================

-- 1. Main team_tasks table
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

-- 2. Task Checklists table (interactive subtasks)
CREATE TABLE IF NOT EXISTS public.task_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean DEFAULT false,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_checklists_task ON public.task_checklists(task_id);

-- 3. Task Activity Log (audit trail of state transitions)
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

-- Enable RLS
ALTER TABLE public.team_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_logs ENABLE ROW LEVEL SECURITY;

-- team_tasks RLS:
-- View: Any active team member
DROP POLICY IF EXISTS "team members view team tasks" ON public.team_tasks;
CREATE POLICY "team members view team tasks" ON public.team_tasks
FOR SELECT TO authenticated
USING (public.is_team_member(team_id) OR public.is_app_admin());

-- Insert: Team leaders can create tasks (or members if permitted by leader)
DROP POLICY IF EXISTS "leaders create team tasks" ON public.team_tasks;
CREATE POLICY "leaders create team tasks" ON public.team_tasks
FOR INSERT TO authenticated
WITH CHECK (public.is_team_leader(team_id) OR public.is_app_admin());

-- Update: Team leaders can update any task; Assignee can update status/submission
DROP POLICY IF EXISTS "leaders and assignees update tasks" ON public.team_tasks;
CREATE POLICY "leaders and assignees update tasks" ON public.team_tasks
FOR UPDATE TO authenticated
USING (
  public.is_team_leader(team_id) OR 
  (public.is_team_member(team_id) AND assigned_to = auth.uid()) OR 
  public.is_app_admin()
);

-- Delete: Only team leaders can delete tasks
DROP POLICY IF EXISTS "leaders delete team tasks" ON public.team_tasks;
CREATE POLICY "leaders delete team tasks" ON public.team_tasks
FOR DELETE TO authenticated
USING (public.is_team_leader(team_id) OR public.is_app_admin());

-- task_checklists RLS:
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

-- task_activity_logs RLS:
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

-- 4. Helper function to transition task state with automatic audit logging
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

  -- Permission checks depending on transition
  IF p_new_status IN ('completed', 'changes_requested') THEN
    IF NOT v_is_leader THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the team leader can approve or request changes on tasks');
    END IF;
  ELSIF p_new_status IN ('accepted', 'in_progress', 'review_pending') THEN
    IF NOT v_is_assignee AND NOT v_is_leader THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the assigned member or team leader can update this task');
    END IF;
  END IF;

  -- Perform update
  UPDATE public.team_tasks
  SET 
    status = p_new_status,
    submission_notes = COALESCE(p_submission_notes, submission_notes),
    submission_link = COALESCE(p_submission_link, submission_link),
    leader_feedback = COALESCE(p_leader_feedback, leader_feedback),
    updated_at = now()
  WHERE id = p_task_id;

  -- Insert activity log
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

NOTIFY pgrst, 'reload schema';
