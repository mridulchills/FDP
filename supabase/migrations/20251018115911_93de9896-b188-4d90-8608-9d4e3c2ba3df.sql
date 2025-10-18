-- Add new comment columns for FDC and Accounts
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS fdc_comment text,
ADD COLUMN IF NOT EXISTS accounts_comment text;

-- Update the trigger to handle the new flow
DROP TRIGGER IF EXISTS on_submission_status_change ON public.submissions;

CREATE OR REPLACE FUNCTION public.handle_submission_status_change_new()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    fdc_user_id UUID;
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
        ELSIF NEW.status = 'Pending HoD Approval' THEN
            notification_message := 'Your submission is now pending HoD approval.';
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
                '/my-submissions'
            );
        END IF;
        
        -- Notify next approver when status changes
        IF NEW.status = 'Pending FDC Approval' THEN
            -- When a new submission is created, notify FDC (admin role)
            SELECT id INTO fdc_user_id 
            FROM users 
            WHERE role = 'admin' 
            LIMIT 1;
            
            IF fdc_user_id IS NOT NULL THEN
                PERFORM create_notification(
                    fdc_user_id,
                    'New submission requires FDC approval.',
                    '/approvals'
                );
            END IF;
        ELSIF NEW.status = 'Approved by FDC' OR NEW.status = 'Pending HoD Approval' THEN
            -- When FDC approves, change to Pending HoD and notify HoD
            IF NEW.status = 'Approved by FDC' THEN
                NEW.status := 'Pending HoD Approval';
            END IF;
            
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
        ELSIF NEW.status = 'Approved by HoD' OR NEW.status = 'Pending Accounts Approval' THEN
            -- When HoD approves, change to Pending Accounts and notify Accounts
            IF NEW.status = 'Approved by HoD' THEN
                NEW.status := 'Pending Accounts Approval';
            END IF;
            
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

-- Recreate the trigger
CREATE TRIGGER on_submission_status_change
    BEFORE UPDATE ON public.submissions
    FOR EACH ROW
    EXECUTE FUNCTION handle_submission_status_change_new();