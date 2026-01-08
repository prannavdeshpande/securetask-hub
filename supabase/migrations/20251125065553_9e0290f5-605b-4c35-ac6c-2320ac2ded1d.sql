-- Allow users to insert their own role during registration
-- This is safe because the trigger will validate the role and set it appropriately

DROP POLICY IF EXISTS "Users can insert their own role during registration" ON public.user_roles;

CREATE POLICY "Users can insert their own role during registration"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);