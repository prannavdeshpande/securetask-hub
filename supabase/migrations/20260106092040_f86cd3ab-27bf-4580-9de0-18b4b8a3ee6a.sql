-- Add mom_taker column to meetings table
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS mom_taker uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add user status column to profiles for availability tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'available' CHECK (status IN ('available', 'busy', 'in_meeting', 'away', 'offline'));