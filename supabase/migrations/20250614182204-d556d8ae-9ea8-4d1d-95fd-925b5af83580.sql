
-- Create storage bucket for documents (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'documents', 
            'documents', 
            false, 
            10485760, -- 10MB limit
            ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
        );
    END IF;
END $$;

-- Drop existing policies if they exist and recreate them
DO $$
BEGIN
    -- Drop storage policies if they exist
    DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
    
    -- Drop submission policies if they exist
    DROP POLICY IF EXISTS "Users can view their own submissions" ON public.submissions;
    DROP POLICY IF EXISTS "Users can create their own submissions" ON public.submissions;
    DROP POLICY IF EXISTS "Users can update their own pending submissions" ON public.submissions;
    DROP POLICY IF EXISTS "HoDs can view department submissions" ON public.submissions;
    DROP POLICY IF EXISTS "HoDs can update department submissions" ON public.submissions;
    DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;
    DROP POLICY IF EXISTS "Admins can update all submissions" ON public.submissions;
    
    -- Drop notification policies if they exist
    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
END $$;

-- Create storage policies for documents bucket
CREATE POLICY "Users can upload their own documents" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own documents" ON storage.objects
FOR SELECT USING (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own documents" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own documents" ON storage.objects
FOR DELETE USING (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable RLS policies for submissions table
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for submissions that work with the existing user_id field
CREATE POLICY "Users can view their own submissions" ON public.submissions
FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can create their own submissions" ON public.submissions
FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can update their own pending submissions" ON public.submissions
FOR UPDATE USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) AND 
    status = 'Pending HoD Approval'
);

-- HoDs can view submissions from their department
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

-- HoDs can update submissions in their department
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

-- Admins can view and update all submissions
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

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Users can update their own notifications" ON public.notifications
FOR UPDATE USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
);

-- Enable realtime for submissions and notifications
ALTER TABLE public.submissions REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add tables to realtime publication (ignore if already exists)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
    EXCEPTION
        WHEN duplicate_object THEN
            NULL; -- Table already in publication
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION
        WHEN duplicate_object THEN
            NULL; -- Table already in publication
    END;
END $$;

-- Create function to create notifications
CREATE OR REPLACE FUNCTION public.create_notification(
    target_user_id UUID,
    notification_message TEXT,
    notification_link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, message, link)
    VALUES (target_user_id, notification_message, notification_link)
    RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$;

-- Create trigger function for submission status changes
CREATE OR REPLACE FUNCTION public.handle_submission_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_user_id UUID;
    notification_message TEXT;
BEGIN
    -- If status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Notify the submission owner
        IF NEW.status = 'Approved by HoD' THEN
            notification_message := 'Your submission has been approved by HoD and sent for final approval.';
        ELSIF NEW.status = 'Rejected by HoD' THEN
            notification_message := 'Your submission has been rejected by HoD.';
        ELSIF NEW.status = 'Approved by Admin' THEN
            notification_message := 'Your submission has been approved and is now complete.';
        ELSIF NEW.status = 'Rejected by Admin' THEN
            notification_message := 'Your submission has been rejected by Admin.';
        END IF;
        
        IF notification_message IS NOT NULL THEN
            PERFORM public.create_notification(
                NEW.user_id,
                notification_message,
                '/submissions'
            );
        END IF;
        
        -- Notify next approver when status changes to approved by HoD
        IF NEW.status = 'Approved by HoD' THEN
            -- Find any admin user to notify
            SELECT id INTO admin_user_id 
            FROM public.users 
            WHERE role = 'admin' 
            LIMIT 1;
            
            IF admin_user_id IS NOT NULL THEN
                PERFORM public.create_notification(
                    admin_user_id,
                    'New submission requires final approval.',
                    '/approvals'
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS on_submission_status_change ON public.submissions;
CREATE TRIGGER on_submission_status_change
    AFTER UPDATE ON public.submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_submission_status_change();
