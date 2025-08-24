-- Create accounts department and update user for testing
INSERT INTO public.departments (id, name, code) 
VALUES ('550e8400-e29b-41d4-a716-446655440003', 'Accounts', 'ACC')
ON CONFLICT (code) DO NOTHING;

-- Update accounts demo user to have the accounts department
UPDATE public.users 
SET department_id = '550e8400-e29b-41d4-a716-446655440003'
WHERE employee_id = 'ACC001';

-- Update submission flow: Faculty -> FDC -> HoD -> Accounts
-- Change default status for new submissions to start with FDC approval
ALTER TABLE public.submissions 
ALTER COLUMN status SET DEFAULT 'Pending FDC Approval'::text;

-- Update the status flow trigger to handle the new workflow: Faculty -> FDC -> HoD -> Accounts
CREATE OR REPLACE FUNCTION public.handle_submission_status_change_new()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    hod_user_id UUID;
    accounts_user_id UUID;
    notification_message TEXT;
BEGIN
    -- If status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Notify the submission owner about status changes
        IF NEW.status = 'Approved by FDC' THEN
            notification_message := 'Your submission has been approved by Faculty Development Cell and sent to HoD for review.';
        ELSIF NEW.status = 'Rejected by FDC' THEN
            notification_message := 'Your submission has been rejected by Faculty Development Cell.';
        ELSIF NEW.status = 'Approved by HoD' THEN
            notification_message := 'Your submission has been approved by HoD and sent to Accounts for final approval.';
        ELSIF NEW.status = 'Rejected by HoD' THEN
            notification_message := 'Your submission has been rejected by HoD.';
        ELSIF NEW.status = 'Approved by Accounts' THEN
            notification_message := 'Your submission has been approved by Accounts and is now complete.';
        ELSIF NEW.status = 'Rejected by Accounts' THEN
            notification_message := 'Your submission has been rejected by Accounts.';
        END IF;
        
        IF notification_message IS NOT NULL THEN
            PERFORM create_notification(
                NEW.user_id,
                notification_message,
                '/submissions'
            );
        END IF;
        
        -- Notify next approver when status changes
        IF NEW.status = 'Approved by FDC' THEN
            -- Find HoD of the submitter's department
            SELECT u.id INTO hod_user_id 
            FROM users u 
            JOIN users submitter ON u.department_id = submitter.department_id
            WHERE submitter.id = NEW.user_id 
            AND u.role = 'hod' 
            LIMIT 1;
            
            IF hod_user_id IS NOT NULL THEN
                PERFORM create_notification(
                    hod_user_id,
                    'New submission requires HoD approval.',
                    '/approvals'
                );
            END IF;
        ELSIF NEW.status = 'Approved by HoD' THEN
            -- Find any accounts user to notify
            SELECT id INTO accounts_user_id 
            FROM users 
            WHERE role = 'accounts' 
            LIMIT 1;
            
            IF accounts_user_id IS NOT NULL THEN
                PERFORM create_notification(
                    accounts_user_id,
                    'New submission requires Accounts approval.',
                    '/approvals'
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;