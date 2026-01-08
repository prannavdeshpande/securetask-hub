-- Fix meeting access RLS without recursion by using a security definer helper

CREATE OR REPLACE FUNCTION public.can_access_meeting(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meetings m
    WHERE m.id = _meeting_id
      AND m.created_by = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.meeting_participants mp
    WHERE mp.meeting_id = _meeting_id
      AND mp.user_id = _user_id
  );
$$;

-- Meetings: replace SELECT policy
DROP POLICY IF EXISTS "Users can view meetings they created or participate in" ON public.meetings;
CREATE POLICY "Users can view meetings they created or participate in"
ON public.meetings
FOR SELECT
USING (public.can_access_meeting(id, auth.uid()));

-- Meeting participants: replace SELECT policy that referenced meeting_participants recursively
DROP POLICY IF EXISTS "Users can view participants of meetings they have access to" ON public.meeting_participants;
CREATE POLICY "Users can view participants of meetings they have access to"
ON public.meeting_participants
FOR SELECT
USING (public.can_access_meeting(meeting_id, auth.uid()));

-- Meeting minutes: simplify SELECT/INSERT policies
DROP POLICY IF EXISTS "Participants can view meeting minutes" ON public.meeting_minutes;
CREATE POLICY "Participants can view meeting minutes"
ON public.meeting_minutes
FOR SELECT
USING (public.can_access_meeting(meeting_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can create meeting minutes" ON public.meeting_minutes;
CREATE POLICY "Participants can create meeting minutes"
ON public.meeting_minutes
FOR INSERT
WITH CHECK (
  auth.uid() = recorded_by
  AND public.can_access_meeting(meeting_id, auth.uid())
);
