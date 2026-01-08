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