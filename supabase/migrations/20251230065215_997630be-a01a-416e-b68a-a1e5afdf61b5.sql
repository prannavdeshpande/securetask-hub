-- Add deadline column to tasks table
ALTER TABLE public.tasks ADD COLUMN deadline TIMESTAMP WITH TIME ZONE;

-- Add reminder_sent column to track if reminder was already sent
ALTER TABLE public.tasks ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT false;