
-- Create configuration tables for dynamic dropdowns
CREATE TABLE public.program_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.certification_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default data for program types
INSERT INTO public.program_types (name, description) VALUES
('FDP', 'Faculty Development Program'),
('Workshop', 'Technical Workshop'),
('Seminar', 'Academic Seminar'),
('Conference', 'Academic Conference'),
('Webinar', 'Online Webinar'),
('Training', 'Professional Training'),
('Symposium', 'Academic Symposium');

-- Insert default data for certification platforms
INSERT INTO public.certification_platforms (name, url) VALUES
('Coursera', 'https://coursera.org'),
('NPTEL', 'https://nptel.ac.in'),
('edX', 'https://edx.org'),
('Udemy', 'https://udemy.com'),
('LinkedIn Learning', 'https://linkedin.com/learning'),
('Swayam', 'https://swayam.gov.in'),
('Other', NULL);

-- Insert default data for domains
INSERT INTO public.domains (name, category) VALUES
('Computer Science', 'Technical'),
('Information Technology', 'Technical'),
('Electronics', 'Technical'),
('Mechanical Engineering', 'Technical'),
('Civil Engineering', 'Technical'),
('Management', 'Non-Technical'),
('Soft Skills', 'Non-Technical'),
('Research Methodology', 'Academic'),
('Other', 'General');

-- Create enhanced audit logs table
CREATE TABLE public.audit_logs_enhanced (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  target_user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.program_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_enhanced ENABLE ROW LEVEL SECURITY;

-- RLS Policies for program_types (Admin can manage, others can read active ones)
CREATE POLICY "Everyone can view active program types" ON public.program_types
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage program types" ON public.program_types
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for certification_platforms
CREATE POLICY "Everyone can view active platforms" ON public.certification_platforms
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage platforms" ON public.certification_platforms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for domains
CREATE POLICY "Everyone can view active domains" ON public.domains
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage domains" ON public.domains
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for audit logs (Only admins can view)
CREATE POLICY "Admins can view audit logs" ON public.audit_logs_enhanced
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs" ON public.audit_logs_enhanced
  FOR INSERT WITH CHECK (true);

-- Create updated_at trigger for new tables
CREATE TRIGGER program_types_updated_at 
  BEFORE UPDATE ON public.program_types 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER certification_platforms_updated_at 
  BEFORE UPDATE ON public.certification_platforms 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER domains_updated_at 
  BEFORE UPDATE ON public.domains 
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create function to log user management actions
CREATE OR REPLACE FUNCTION public.log_user_action(
  action_type TEXT,
  target_user_id UUID,
  old_data JSONB DEFAULT NULL,
  new_data JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
  current_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT id INTO current_user_id 
  FROM public.users 
  WHERE auth_user_id = auth.uid();
  
  -- Insert audit log
  INSERT INTO public.audit_logs_enhanced (
    user_id, 
    target_user_id, 
    action, 
    entity_type, 
    old_values, 
    new_values
  ) VALUES (
    current_user_id,
    target_user_id,
    action_type,
    'user',
    old_data,
    new_data
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;
