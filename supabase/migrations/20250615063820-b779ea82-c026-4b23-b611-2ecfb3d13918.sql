
-- First, let's create some demo user profiles in the users table
-- These will be linked to auth users that we'll create through the Supabase dashboard

-- Demo Faculty User
INSERT INTO public.users (
  auth_user_id, 
  employee_id, 
  name, 
  email, 
  role, 
  department_id, 
  designation, 
  institution
) VALUES (
  NULL, -- We'll update this after creating the auth user
  'FAC001',
  'Dr. John Smith',
  'FAC001@nmit.ac.in',
  'faculty',
  (SELECT id FROM public.departments WHERE code = 'CSE' LIMIT 1),
  'Assistant Professor',
  'NMIT'
);

-- Demo HoD User  
INSERT INTO public.users (
  auth_user_id,
  employee_id,
  name,
  email,
  role,
  department_id,
  designation,
  institution
) VALUES (
  NULL, -- We'll update this after creating the auth user
  'HOD001',
  'Dr. Sarah Johnson',
  'HOD001@nmit.ac.in',
  'hod',
  (SELECT id FROM public.departments WHERE code = 'CSE' LIMIT 1),
  'Professor & Head',
  'NMIT'
);

-- Demo Admin User
INSERT INTO public.users (
  auth_user_id,
  employee_id,
  name,
  email,
  role,
  department_id,
  designation,
  institution
) VALUES (
  NULL, -- We'll update this after creating the auth user
  'ADM001',
  'Dr. Michael Brown',
  'ADM001@nmit.ac.in',
  'admin',
  (SELECT id FROM public.departments WHERE code = 'CSE' LIMIT 1),
  'Dean Academic Affairs',
  'NMIT'
);

-- Update the department to set the HoD
UPDATE public.departments 
SET hod_user_id = (SELECT id FROM public.users WHERE employee_id = 'HOD001')
WHERE code = 'CSE';

-- Add a few more demo users in different departments
INSERT INTO public.users (
  auth_user_id,
  employee_id,
  name,
  email,
  role,
  department_id,
  designation,
  institution
) VALUES 
(
  NULL,
  'FAC002',
  'Dr. Emily Davis',
  'FAC002@nmit.ac.in',
  'faculty',
  (SELECT id FROM public.departments WHERE code = 'ECE' LIMIT 1),
  'Associate Professor',
  'NMIT'
),
(
  NULL,
  'HOD002',
  'Dr. Robert Wilson',
  'HOD002@nmit.ac.in',
  'hod',
  (SELECT id FROM public.departments WHERE code = 'ECE' LIMIT 1),
  'Professor & Head',
  'NMIT'
);

-- Update ECE department HoD
UPDATE public.departments 
SET hod_user_id = (SELECT id FROM public.users WHERE employee_id = 'HOD002')
WHERE code = 'ECE';

-- Create some sample submissions for demonstration
INSERT INTO public.submissions (
  user_id,
  module_type,
  form_data,
  status,
  created_at
) VALUES 
(
  (SELECT id FROM public.users WHERE employee_id = 'FAC001'),
  'attended',
  '{
    "title": "Machine Learning Workshop",
    "type": "Workshop",
    "mode": "Online",
    "startDate": "2024-01-15",
    "endDate": "2024-01-17",
    "duration": 24,
    "durationType": "hours",
    "organizingInstitution": "IIT Bangalore",
    "venue": "Online Platform",
    "domain": "Own",
    "objective": "To learn advanced machine learning techniques and their practical applications",
    "keyLearnings": "Deep learning algorithms, neural networks, and practical implementation strategies",
    "contribution": "Enhanced knowledge in ML algorithms which will improve teaching methodology",
    "sponsored": false,
    "documentUrl": ""
  }',
  'Pending HoD Approval',
  '2024-01-20 10:00:00'
),
(
  (SELECT id FROM public.users WHERE employee_id = 'FAC002'),
  'attended',
  '{
    "title": "Digital Signal Processing Conference",
    "type": "Conference",
    "mode": "Offline",
    "startDate": "2024-02-01",
    "endDate": "2024-02-03",
    "duration": 3,
    "durationType": "days",
    "organizingInstitution": "IEEE",
    "venue": "Bangalore Convention Center",
    "domain": "Own",
    "objective": "To understand latest trends in digital signal processing",
    "keyLearnings": "Advanced DSP techniques, real-time processing methods",
    "contribution": "Updated curriculum with latest DSP trends",
    "sponsored": true,
    "sponsorName": "IEEE Bangalore Section",
    "documentUrl": ""
  }',
  'Approved by HoD',
  '2024-02-05 14:30:00'
);
