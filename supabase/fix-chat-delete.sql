-- Fix Chat Messages Delete RLS Policies
-- Run this in Supabase SQL Editor

-- 1. Drop old restrictive delete policy that only allowed app admin
DROP POLICY IF EXISTS "delete chat_messages" ON public.chat_messages;

-- 2. Allow user to delete their own messages, OR allow team leader to delete messages, OR allow app admin
CREATE POLICY "delete chat_messages" ON public.chat_messages
FOR DELETE TO authenticated
USING (
  sender_id = auth.uid() 
  OR public.is_team_leader(team_id) 
  OR public.is_app_admin()
);

-- 3. Also create a dedicated RPC function to delete a single message safely
CREATE OR REPLACE FUNCTION public.delete_chat_message(p_message_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_sender_id uuid;
  v_team_id uuid;
  v_is_leader boolean;
BEGIN
  SELECT sender_id, team_id INTO v_sender_id, v_team_id
  FROM public.chat_messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Message not found');
  END IF;

  v_is_leader := public.is_team_leader(v_team_id);

  -- Only sender or team leader or admin can delete
  IF auth.uid() != v_sender_id AND NOT v_is_leader AND NOT public.is_app_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Permission denied');
  END IF;

  DELETE FROM public.chat_messages WHERE id = p_message_id;

  RETURN json_build_object('success', true);
END;
$function$;

-- 4. Create an RPC function to clear entire team chat (only leader or admin)
CREATE OR REPLACE FUNCTION public.clear_team_chat(p_team_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only leader or admin can clear the whole chat box
  IF NOT public.is_team_leader(p_team_id) AND NOT public.is_app_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Only the team leader can clear the chat box');
  END IF;

  DELETE FROM public.chat_messages WHERE team_id = p_team_id;

  RETURN json_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_chat_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_team_chat(uuid) TO authenticated;
