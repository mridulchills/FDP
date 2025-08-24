-- Update submission status default and add accounts user
-- First update the default status for new submissions
ALTER TABLE public.submissions 
ALTER COLUMN status SET DEFAULT 'Pending Admin Approval'::text;

-- Insert accounts demo user
INSERT INTO public.users (
  employee_id,
  name,
  email,
  role,
  designation,
  institution,
  department_id
) VALUES (
  'ACC001',
  'Dr. Jennifer Wilson',
  'ACC001@nmit.ac.in',
  'accounts',
  'Accounts Officer',
  'NMIT',
  (SELECT id FROM public.departments LIMIT 1)
) ON CONFLICT (employee_id) DO NOTHING;