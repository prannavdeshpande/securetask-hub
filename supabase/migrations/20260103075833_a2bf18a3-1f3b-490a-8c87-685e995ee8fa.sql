-- Create meetings table for storing meeting information
CREATE TABLE public.meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  meeting_date timestamp with time zone NOT NULL,
  duration_minutes integer DEFAULT 60,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create meeting_participants table
CREATE TABLE public.meeting_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attended boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

-- Create meeting_minutes table for storing notes/minutes from meetings
CREATE TABLE public.meeting_minutes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  content text NOT NULL,
  recorded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_availability table for calendar availability
CREATE TABLE public.user_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

-- Enable RLS on all new tables
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;

-- Meetings policies
CREATE POLICY "Users can view meetings they created or participate in"
ON public.meetings FOR SELECT
USING (
  created_by = auth.uid() OR 
  EXISTS (SELECT 1 FROM meeting_participants WHERE meeting_id = meetings.id AND user_id = auth.uid())
);

CREATE POLICY "Users can create meetings"
ON public.meetings FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own meetings"
ON public.meetings FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own meetings"
ON public.meetings FOR DELETE
USING (auth.uid() = created_by);

-- Meeting participants policies
CREATE POLICY "Users can view participants of meetings they have access to"
ON public.meeting_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meetings 
    WHERE meetings.id = meeting_participants.meeting_id 
    AND (meetings.created_by = auth.uid() OR EXISTS (
      SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = meetings.id AND mp.user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Meeting creators can add participants"
ON public.meeting_participants FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM meetings WHERE id = meeting_id AND created_by = auth.uid())
);

CREATE POLICY "Meeting creators can remove participants"
ON public.meeting_participants FOR DELETE
USING (
  EXISTS (SELECT 1 FROM meetings WHERE id = meeting_id AND created_by = auth.uid())
);

CREATE POLICY "Participants can update their attendance"
ON public.meeting_participants FOR UPDATE
USING (user_id = auth.uid());

-- Meeting minutes policies
CREATE POLICY "Participants can view meeting minutes"
ON public.meeting_minutes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM meeting_participants 
    WHERE meeting_id = meeting_minutes.meeting_id AND user_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM meetings WHERE id = meeting_minutes.meeting_id AND created_by = auth.uid()
  )
);

CREATE POLICY "Participants can create meeting minutes"
ON public.meeting_minutes FOR INSERT
WITH CHECK (
  auth.uid() = recorded_by AND (
    EXISTS (SELECT 1 FROM meeting_participants WHERE meeting_id = meeting_minutes.meeting_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM meetings WHERE id = meeting_minutes.meeting_id AND created_by = auth.uid())
  )
);

CREATE POLICY "Users can update their own minutes"
ON public.meeting_minutes FOR UPDATE
USING (auth.uid() = recorded_by);

CREATE POLICY "Users can delete their own minutes"
ON public.meeting_minutes FOR DELETE
USING (auth.uid() = recorded_by);

-- User availability policies
CREATE POLICY "Anyone authenticated can view user availability"
ON public.user_availability FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their own availability"
ON public.user_availability FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own availability"
ON public.user_availability FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own availability"
ON public.user_availability FOR DELETE
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_minutes_updated_at
BEFORE UPDATE ON public.meeting_minutes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_availability_updated_at
BEFORE UPDATE ON public.user_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_availability;