-- Allow admins to assign/create tasks for any user
CREATE POLICY "Admins can create tasks for any user"
ON public.tasks
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));