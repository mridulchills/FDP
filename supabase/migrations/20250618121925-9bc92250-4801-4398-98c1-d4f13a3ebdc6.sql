
-- Ensure the submissions bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'submissions', 
    'submissions', 
    false, 
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];

-- Create helper function to extract user ID from storage path
CREATE OR REPLACE FUNCTION public.get_user_from_storage_path(file_path text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT split_part(file_path, '/', 1)::uuid;
$$;

-- Create helper function to get user department
CREATE OR REPLACE FUNCTION public.get_user_department(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT department_id FROM public.users WHERE auth_user_id = user_id;
$$;

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can upload their own submission files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own submission files" ON storage.objects;
DROP POLICY IF EXISTS "HoDs can view submission files from their department" ON storage.objects;
DROP POLICY IF EXISTS "Admins can access all submission files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Create new comprehensive storage policies
CREATE POLICY "Users can upload their own files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'submissions' AND
  auth.uid() = public.get_user_from_storage_path(name)
);

CREATE POLICY "Users can view their own files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'submissions' AND
  auth.uid() = public.get_user_from_storage_path(name)
);

CREATE POLICY "HoDs can view department files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'submissions' AND
  public.get_user_role(auth.uid()) = 'hod' AND
  public.get_user_from_storage_path(name) IN (
    SELECT auth_user_id FROM public.users
    WHERE department_id = public.get_user_department(auth.uid())
  )
);

CREATE POLICY "Admins can view all files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'submissions' AND
  public.get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "Users can update their own files" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'submissions' AND
  auth.uid() = public.get_user_from_storage_path(name)
);

CREATE POLICY "Users can delete their own files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'submissions' AND
  auth.uid() = public.get_user_from_storage_path(name)
);
