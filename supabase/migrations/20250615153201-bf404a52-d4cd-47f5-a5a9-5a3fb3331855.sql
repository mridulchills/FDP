
-- Fix storage bucket creation and policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents', 
    'documents', 
    false, 
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];

-- Drop existing storage policies and recreate them
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Create proper storage policies that work with the file structure
CREATE POLICY "Users can upload documents" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND 
    (storage.foldername(objects.name))[1] IN (
        SELECT auth_user_id::text FROM public.users WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Users can view documents" ON storage.objects
FOR SELECT USING (
    bucket_id = 'documents' AND (
        -- Users can see their own files
        (storage.foldername(objects.name))[1] IN (
            SELECT auth_user_id::text FROM public.users WHERE auth_user_id = auth.uid()
        )
        OR
        -- HoDs can see department files
        EXISTS (
            SELECT 1 FROM public.users u1
            JOIN public.users u2 ON u1.department_id = u2.department_id
            WHERE u1.auth_user_id = auth.uid() 
            AND u1.role = 'hod'
            AND u2.auth_user_id::text = (storage.foldername(objects.name))[1]
        )
        OR
        -- Admins can see all files
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_user_id = auth.uid() AND role = 'admin'
        )
    )
);

CREATE POLICY "Users can update their documents" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'documents' AND 
    (storage.foldername(objects.name))[1] IN (
        SELECT auth_user_id::text FROM public.users WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their documents" ON storage.objects
FOR DELETE USING (
    bucket_id = 'documents' AND 
    (storage.foldername(objects.name))[1] IN (
        SELECT auth_user_id::text FROM public.users WHERE auth_user_id = auth.uid()
    )
);

-- Fix submission RLS policies to ensure proper hierarchy visibility
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can create their own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can update their own pending submissions" ON public.submissions;
DROP POLICY IF EXISTS "HoDs can view department submissions" ON public.submissions;
DROP POLICY IF EXISTS "HoDs can update department submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can update all submissions" ON public.submissions;

-- Recreate submission policies with proper hierarchy
CREATE POLICY "Faculty can view own submissions" ON public.submissions
FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Faculty can create own submissions" ON public.submissions
FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Faculty can update own pending submissions" ON public.submissions
FOR UPDATE USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) AND 
    status = 'Pending HoD Approval'
);

CREATE POLICY "HoDs can view department submissions" ON public.submissions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users u1
        JOIN public.users u2 ON u1.department_id = u2.department_id
        WHERE u1.auth_user_id = auth.uid() 
        AND u1.role = 'hod'
        AND u2.id = submissions.user_id
    )
);

CREATE POLICY "HoDs can update department submissions" ON public.submissions
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users u1
        JOIN public.users u2 ON u1.department_id = u2.department_id
        WHERE u1.auth_user_id = auth.uid() 
        AND u1.role = 'hod'
        AND u2.id = submissions.user_id
    )
);

CREATE POLICY "Admins can view all submissions" ON public.submissions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can update all submissions" ON public.submissions
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
);

-- Update notification policies to work properly
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can view their notifications" ON public.notifications
FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can update their notifications" ON public.notifications
FOR UPDATE USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);
