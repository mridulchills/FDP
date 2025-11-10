-- Allow admins to delete submissions
CREATE POLICY "Admins can delete all submissions"
ON public.submissions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
    AND users.role = 'admin'
  )
);