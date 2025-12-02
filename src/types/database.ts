
// Database response types that match the actual Supabase schema
export interface DatabaseSubmission {
  id: string;
  user_id: string;
  module_type: string;
  status: string;
  document_url: string | null;
  hod_comment: string | null;
  admin_comment: string | null;
  form_data: any;
  created_at: string;
  updated_at: string;
  user?: DatabaseUser;
}

export interface DatabaseDepartment {
  id: string;
  name: string;
  hod_user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseUser {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  department_id: string | null;
  designation: string;
  institution: string;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
  department?: DatabaseDepartment;
}
