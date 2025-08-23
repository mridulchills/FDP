-- First check what submission statuses currently exist
UPDATE submissions SET status = 'Pending Admin Approval' WHERE status = 'Pending HoD Approval';

-- Add accounts_comment column
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS accounts_comment TEXT;

-- Update RLS policies for accounts role
CREATE POLICY "Accounts can view HoD-approved submissions" 
ON submissions FOR SELECT 
USING (get_current_user_role() = 'accounts' AND status = 'Approved by HoD');

CREATE POLICY "Accounts can update HoD-approved submissions" 
ON submissions FOR UPDATE 
USING (get_current_user_role() = 'accounts' AND status = 'Approved by HoD');

-- Remove overly permissive policies that allow any submissions
DROP POLICY IF EXISTS "Faculty can create own submissions" ON submissions;
DROP POLICY IF EXISTS "Faculty can update own pending submissions" ON submissions;

-- Add stricter policies for faculty  
CREATE POLICY "Faculty can create their own submissions strictly" 
ON submissions FOR INSERT 
WITH CHECK (
  user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()) 
  AND get_current_user_role() = 'faculty'
);

CREATE POLICY "Faculty can update only their pending admin approval submissions" 
ON submissions FOR UPDATE 
USING (
  user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()) 
  AND status = 'Pending Admin Approval'
  AND get_current_user_role() = 'faculty'
);

-- Update submission status change trigger for new flow
CREATE OR REPLACE FUNCTION handle_submission_status_change_new()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    hod_user_id UUID;
    accounts_user_id UUID;
    notification_message TEXT;
BEGIN
    -- If status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Notify the submission owner about status changes
        IF NEW.status = 'Approved by Admin' THEN
            notification_message := 'Your submission has been approved by Admin and sent to HoD for review.';
        ELSIF NEW.status = 'Rejected by Admin' THEN
            notification_message := 'Your submission has been rejected by Admin.';
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
        IF NEW.status = 'Approved by Admin' THEN
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
$$;

-- Replace the old trigger
DROP TRIGGER IF EXISTS submission_status_change ON submissions;
CREATE TRIGGER submission_status_change_new
    AFTER UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION handle_submission_status_change_new();