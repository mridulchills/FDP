-- Update workflow: Faculty -> Faculty Development Cell -> HoD -> Accounts
-- Add new role 'accounts' and update submission statuses

-- Update users table to support 'accounts' role
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('faculty', 'hod', 'admin', 'accounts'));

-- Update submissions table to support new workflow
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE public.submissions ADD CONSTRAINT submissions_status_check 
CHECK (status IN (
  'Pending Faculty Development Cell Approval',
  'Approved by Faculty Development Cell', 
  'Rejected by Faculty Development Cell',
  'Pending HoD Approval',
  'Approved by HoD',
  'Rejected by HoD',
  'Pending Accounts Approval',
  'Approved by Accounts',
  'Rejected by Accounts'
));

-- Add new comment columns for the new workflow
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS faculty_development_cell_comment TEXT,
ADD COLUMN IF NOT EXISTS accounts_comment TEXT;

-- Rename admin_comment to maintain backward compatibility during transition
-- We'll keep admin_comment for now and map it to faculty_development_cell_comment in the app

-- Update default status for new submissions
ALTER TABLE public.submissions 
ALTER COLUMN status SET DEFAULT 'Pending Faculty Development Cell Approval';

-- Update existing submissions to use new status names
UPDATE public.submissions 
SET status = CASE 
  WHEN status = 'Pending HoD Approval' THEN 'Pending Faculty Development Cell Approval'
  WHEN status = 'Approved by HoD' THEN 'Approved by Faculty Development Cell'
  WHEN status = 'Rejected by HoD' THEN 'Rejected by Faculty Development Cell'
  WHEN status = 'Approved by Admin' THEN 'Approved by Accounts'
  WHEN status = 'Rejected by Admin' THEN 'Rejected by Accounts'
  ELSE status
END;

-- Update RLS policies to support new roles and workflow

-- Drop existing policies that reference old roles
DROP POLICY IF EXISTS "Users can view their own profile and department colleagues" ON public.users;
DROP POLICY IF EXISTS "Only admins can manage users" ON public.users;
DROP POLICY IF EXISTS "HoDs can view department submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;
DROP POLICY IF EXISTS "HoDs can update department submissions for approval" ON public.submissions;
DROP POLICY IF EXISTS "Admins can update HoD-approved submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;

-- Create new RLS policies for updated workflow

-- Users policies
CREATE POLICY "Users can view their own profile and department colleagues" ON public.users
  FOR SELECT USING (
    auth_user_id = auth.uid() OR 
    department_id = public.get_current_user_department() OR
    public.get_current_user_role() IN ('hod', 'admin', 'accounts')
  );

CREATE POLICY "HoDs and Admins can manage users" ON public.users
  FOR ALL USING (public.get_current_user_role() IN ('hod', 'admin'));

-- Submissions policies
CREATE POLICY "Faculty Development Cell can view all submissions" ON public.submissions
  FOR SELECT USING (public.get_current_user_role() = 'admin');

CREATE POLICY "HoDs can view department submissions" ON public.submissions
  FOR SELECT USING (
    public.get_current_user_role() = 'hod' AND
    user_id IN (
      SELECT id FROM public.users 
      WHERE department_id = public.get_current_user_department()
    )
  );

CREATE POLICY "Accounts can view approved submissions" ON public.submissions
  FOR SELECT USING (
    public.get_current_user_role() = 'accounts' AND
    status = 'Approved by HoD'
  );

CREATE POLICY "Faculty Development Cell can update pending submissions" ON public.submissions
  FOR UPDATE USING (
    public.get_current_user_role() = 'admin' AND
    status = 'Pending Faculty Development Cell Approval'
  );

CREATE POLICY "HoDs can update Faculty Development Cell approved submissions" ON public.submissions
  FOR UPDATE USING (
    public.get_current_user_role() = 'hod' AND
    user_id IN (
      SELECT id FROM public.users 
      WHERE department_id = public.get_current_user_department()
    ) AND
    status = 'Approved by Faculty Development Cell'
  );

CREATE POLICY "Accounts can update HoD-approved submissions" ON public.submissions
  FOR UPDATE USING (
    public.get_current_user_role() = 'accounts' AND
    status = 'Approved by HoD'
  );

CREATE POLICY "Faculty can update their pending submissions" ON public.submissions
  FOR UPDATE USING (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) AND
    status = 'Pending Faculty Development Cell Approval'
  );

-- Audit logs policies
CREATE POLICY "HoDs and Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.get_current_user_role() IN ('hod', 'admin'));

-- Update function to handle new roles
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $
  SELECT role FROM public.users WHERE auth_user_id = auth.uid();
$ LANGUAGE SQL SECURITY DEFINER STABLE;