
-- Create the submissions storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('submissions', 'submissions', false);

-- Create RLS policies for the submissions bucket
CREATE POLICY "Users can upload their own submission files" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'submissions' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own submission files" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'submissions' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "HoDs can view submission files from their department" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'submissions' AND
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid() 
    AND u.role = 'hod'
  )
);

CREATE POLICY "Admins can access all submission files" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'submissions' AND
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid() 
    AND u.role = 'admin'
  )
);

-- Create a helper function to get user role for RLS policies
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE auth_user_id = user_id;
$$;
