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
