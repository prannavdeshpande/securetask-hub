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