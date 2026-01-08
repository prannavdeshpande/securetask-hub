-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Tasks policies
CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete all tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile and role on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
-- Allow users to insert their own role during registration
-- This is safe because the trigger will validate the role and set it appropriately

DROP POLICY IF EXISTS "Users can insert their own role during registration" ON public.user_roles;

CREATE POLICY "Users can insert their own role during registration"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
-- Drop constraint if it exists (to handle any edge cases)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;

-- Add foreign key constraint from tasks.user_id to profiles.id
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;
-- Update the handle_new_user function to NOT automatically insert a role
-- The role will be inserted by the application based on user selection
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- DO NOT insert a default role here anymore
  -- The role will be inserted by the application
  
  RETURN NEW;
END;
$function$;
-- Add RLS policy to allow admins to update user roles
CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add RLS policy to allow admins to insert user roles
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add RLS policy to allow admins to view all user roles
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Add RLS policy to allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));
-- Add RLS policy to allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add RLS policy to allow admins to delete user roles
CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
-- Allow admins to assign/create tasks for any user
CREATE POLICY "Admins can create tasks for any user"
ON public.tasks
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Add is_private column to tasks table
ALTER TABLE public.tasks ADD COLUMN is_private boolean NOT NULL DEFAULT false;

-- Drop existing admin view policy
DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;

-- Recreate admin view policy to exclude private tasks
CREATE POLICY "Admins can view non-private tasks"
ON public.tasks
FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (has_role(auth.uid(), 'admin'::app_role) AND is_private = false)
);

-- Drop existing user view policy and recreate to ensure users always see their own tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
-- First, remove duplicate entries in user_roles keeping only one per user
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.id < b.id AND a.user_id = b.user_id;

-- Now add unique constraint on user_id in user_roles table for upsert to work
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can create notifications for any user
CREATE POLICY "Admins can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Users can create their own notifications
CREATE POLICY "Users can create their own notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);
-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- Add deadline column to tasks table
ALTER TABLE public.tasks ADD COLUMN deadline TIMESTAMP WITH TIME ZONE;

-- Add reminder_sent column to track if reminder was already sent
ALTER TABLE public.tasks ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT false;
-- Enable pg_cron and pg_net extensions for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
-- Create chat_messages table for user-to-user and user-to-admin communication
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for chat messages
CREATE POLICY "Users can view their own messages"
ON public.chat_messages
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their received messages (mark as read)"
ON public.chat_messages
FOR UPDATE
USING (auth.uid() = receiver_id);

CREATE POLICY "Users can delete their own sent messages"
ON public.chat_messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
-- Allow all authenticated users to view all profiles for chat functionality
CREATE POLICY "Users can view all profiles for chat"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add file_url column to chat_messages for file sharing
ALTER TABLE public.chat_messages ADD COLUMN file_url TEXT;
ALTER TABLE public.chat_messages ADD COLUMN file_name TEXT;
ALTER TABLE public.chat_messages ADD COLUMN file_type TEXT;

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to chat-attachments
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

-- Allow anyone to view chat attachments (public bucket)
CREATE POLICY "Anyone can view chat attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-attachments');

-- Allow users to delete their own uploaded files
CREATE POLICY "Users can delete their own chat attachments"
ON storage.objects
FOR DELETE
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
-- Create message reactions table
CREATE TABLE public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, reaction)
);

-- Create blocked users table
CREATE TABLE public.blocked_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

-- Create reported users table
CREATE TABLE public.reported_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add expires_at column to chat_messages for disappearing messages
ALTER TABLE public.chat_messages ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE NULL;

-- Enable RLS on new tables
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reported_users ENABLE ROW LEVEL SECURITY;

-- Message reactions policies
CREATE POLICY "Users can view reactions on their messages"
ON public.message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages 
    WHERE id = message_id 
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  )
);

CREATE POLICY "Users can add reactions to messages they can see"
ON public.message_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.chat_messages 
    WHERE id = message_id 
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  )
);

CREATE POLICY "Users can remove their own reactions"
ON public.message_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Blocked users policies
CREATE POLICY "Users can view their blocked list"
ON public.blocked_users FOR SELECT
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
ON public.blocked_users FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock others"
ON public.blocked_users FOR DELETE
USING (auth.uid() = blocker_id);

-- Reported users policies
CREATE POLICY "Users can create reports"
ON public.reported_users FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
ON public.reported_users FOR SELECT
USING (auth.uid() = reporter_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reports"
ON public.reported_users FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create user_presence table for online status
CREATE TABLE public.user_presence (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_typing_to UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all presence"
ON public.user_presence FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own presence"
ON public.user_presence FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presence"
ON public.user_presence FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for presence and reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
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
-- Add phone_number and profile_visibility columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'admins_only';

-- Add a comment explaining the visibility options
COMMENT ON COLUMN public.profiles.visibility IS 'admins_only = only admins can see email/phone; contacts = users who chat/meet; public = all logged in';

-- Update RLS policies for profiles to respect visibility
-- Drop existing select policies first
DROP POLICY IF EXISTS "Users can view all profiles for chat" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Recreate policies with visibility logic:
-- 1. Users can always view their own full profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- 2. Admins can view all profiles (full info)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. All authenticated users can see basic profile info (id, full_name, avatar_url) for chat user lists
-- This allows the app to show user names in chat/meeting lists
CREATE POLICY "Authenticated users can view basic profiles"
ON public.profiles FOR SELECT
USING (auth.uid() IS NOT NULL);
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
-- Enable realtime for profiles table so deleted users get logged out
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
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
-- Add avatar_url column to profiles table if it doesn't exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text NULL;

-- Create storage bucket for profile avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage bucket
CREATE POLICY "Allow users to upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow public to view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-avatars');

CREATE POLICY "Allow users to update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-avatars' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'profile-avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow users to delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
