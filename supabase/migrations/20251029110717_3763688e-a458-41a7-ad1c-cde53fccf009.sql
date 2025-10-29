-- Fix RLS policies for accounts role to update submissions
-- The issue is that accounts can only see/update submissions with status 'Approved by HoD'
-- but the trigger automatically changes it to 'Pending Accounts Approval'

-- Drop the old restrictive policies for accounts
DROP POLICY IF EXISTS "Accounts can update HoD-approved submissions" ON submissions;
DROP POLICY IF EXISTS "Accounts can view HoD-approved submissions" ON submissions;

-- Create new policies that work with the actual workflow
CREATE POLICY "Accounts can view pending submissions"
ON submissions
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'accounts'
  AND status = 'Pending Accounts Approval'
);

CREATE POLICY "Accounts can update pending submissions"
ON submissions
FOR UPDATE
TO authenticated
USING (
  get_current_user_role() = 'accounts'
  AND status = 'Pending Accounts Approval'
)
WITH CHECK (
  get_current_user_role() = 'accounts'
  AND status IN ('Approved by Accounts', 'Rejected by Accounts')
);