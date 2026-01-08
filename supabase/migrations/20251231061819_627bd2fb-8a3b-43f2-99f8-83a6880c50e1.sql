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