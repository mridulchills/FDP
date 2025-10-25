-- Add RLS policy for Accounts to view all submissions
CREATE POLICY "Accounts can view all submissions"
ON public.submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.auth_user_id = auth.uid()
    AND users.role = 'accounts'
  )
);