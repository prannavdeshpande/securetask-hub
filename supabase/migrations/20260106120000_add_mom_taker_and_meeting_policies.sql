-- Add optional mom_taker column to meetings (nullable, references profiles)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS mom_taker uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Drop existing policies if they exist to recreate them properly
DROP POLICY IF EXISTS meetings_insert_own ON public.meetings;
DROP POLICY IF EXISTS meetings_select_creator_or_participant ON public.meetings;
DROP POLICY IF EXISTS meetings_update_own ON public.meetings;
DROP POLICY IF EXISTS meetings_delete_own ON public.meetings;

-- Ensure RLS is enabled
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Allow insert when created_by = auth.uid()
CREATE POLICY meetings_insert_own
  ON public.meetings
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Allow select for creators or participants
CREATE POLICY meetings_select_creator_or_participant
  ON public.meetings
  FOR SELECT
  USING (
    auth.uid() = created_by OR EXISTS (
      SELECT 1 FROM public.meeting_participants mp
      WHERE mp.meeting_id = meetings.id AND mp.user_id = auth.uid()
    )
  );

-- Allow update for creators
CREATE POLICY meetings_update_own
  ON public.meetings
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Allow delete for creators
CREATE POLICY meetings_delete_own
  ON public.meetings
  FOR DELETE
  USING (auth.uid() = created_by);
