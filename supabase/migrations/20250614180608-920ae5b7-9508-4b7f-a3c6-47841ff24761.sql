
-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  hod_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create users table (profiles that reference auth.users)
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('faculty', 'hod', 'admin')),
  department_id UUID REFERENCES public.departments(id),
  designation TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT 'NMIT',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraint for HOD
ALTER TABLE public.departments 
ADD CONSTRAINT fk_departments_hod 
FOREIGN KEY (hod_user_id) REFERENCES public.users(id);

-- Create submissions table
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  module_type TEXT NOT NULL CHECK (module_type IN ('attended', 'organized', 'certification')),
  form_data JSONB NOT NULL,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pending HoD Approval' CHECK (status IN (
    'Pending HoD Approval',
    'Approved by HoD', 
    'Rejected by HoD',
    'Approved by Admin',
    'Rejected by Admin'
  )),
  hod_comment TEXT,
  admin_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer functions to prevent RLS recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE auth_user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_user_department()
RETURNS UUID AS $$
  SELECT department_id FROM public.users WHERE auth_user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for departments
CREATE POLICY "Everyone can view departments" ON public.departments
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify departments" ON public.departments
  FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for users
CREATE POLICY "Users can view their own profile and department colleagues" ON public.users
  FOR SELECT USING (
    auth_user_id = auth.uid() OR 
    department_id = public.get_current_user_department() OR
    public.get_current_user_role() IN ('hod', 'admin')
  );

CREATE POLICY "Only admins can manage users" ON public.users
  FOR ALL USING (public.get_current_user_role() = 'admin');

-- RLS Policies for submissions
CREATE POLICY "Faculty can view their own submissions" ON public.submissions
  FOR SELECT USING (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "HoDs can view department submissions" ON public.submissions
  FOR SELECT USING (
    public.get_current_user_role() = 'hod' AND
    user_id IN (
      SELECT id FROM public.users 
      WHERE department_id = public.get_current_user_department()
    )
  );

CREATE POLICY "Admins can view all submissions" ON public.submissions
  FOR SELECT USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Faculty can create their own submissions" ON public.submissions
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Faculty can update their pending submissions" ON public.submissions
  FOR UPDATE USING (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid()) AND
    status = 'Pending HoD Approval'
  );

CREATE POLICY "HoDs can update department submissions for approval" ON public.submissions
  FOR UPDATE USING (
    public.get_current_user_role() = 'hod' AND
    user_id IN (
      SELECT id FROM public.users 
      WHERE department_id = public.get_current_user_department()
    ) AND
    status = 'Pending HoD Approval'
  );

CREATE POLICY "Admins can update HoD-approved submissions" ON public.submissions
  FOR UPDATE USING (
    public.get_current_user_role() = 'admin' AND
    status = 'Approved by HoD'
  );

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (
    user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- RLS Policies for audit logs
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
  FOR SELECT USING (public.get_current_user_role() = 'admin');

CREATE POLICY "System can create audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Insert sample departments
INSERT INTO public.departments (name, code) VALUES
  ('Computer Science & Engineering', 'CSE'),
  ('Information Science & Engineering', 'ISE'),
  ('Electronics & Communication Engineering', 'ECE'),
  ('Mechanical Engineering', 'ME'),
  ('Civil Engineering', 'CE');

-- Create trigger to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
