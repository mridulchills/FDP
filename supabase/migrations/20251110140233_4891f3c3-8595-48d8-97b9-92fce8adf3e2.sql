-- Allow users to update their own profile information
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (
  auth_user_id = auth.uid() 
  AND role = (SELECT role FROM public.users WHERE auth_user_id = auth.uid())
);

-- Add comment explaining the policy
COMMENT ON POLICY "Users can update their own profile" ON public.users IS 
'Allows users to update their own name, designation, and employee_id. Prevents users from changing their role.';