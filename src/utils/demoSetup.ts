
import { supabase } from '@/integrations/supabase/client';

export interface DemoUser {
  employeeId: string;
  email: string;
  password: string;
  name: string;
  role: string;
  designation: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    employeeId: 'FAC001',
    email: 'FAC001@nmit.ac.in',
    password: 'demo123',
    name: 'Dr. John Smith',
    role: 'faculty',
    designation: 'Assistant Professor'
  },
  {
    employeeId: 'HOD001',
    email: 'HOD001@nmit.ac.in',
    password: 'demo123',
    name: 'Dr. Sarah Johnson',
    role: 'hod',
    designation: 'Professor & Head'
  },
  {
    employeeId: 'ADM001',
    email: 'ADM001@nmit.ac.in',
    password: 'demo123',
    name: 'Dr. Michael Brown',
    role: 'admin',
    designation: 'Dean Academic Affairs'
  },
  {
    employeeId: 'FAC002',
    email: 'FAC002@nmit.ac.in',
    password: 'demo123',
    name: 'Dr. Emily Davis',
    role: 'faculty',
    designation: 'Associate Professor'
  },
  {
    employeeId: 'HOD002',
    email: 'HOD002@nmit.ac.in',
    password: 'demo123',
    name: 'Dr. Robert Wilson',
    role: 'hod',
    designation: 'Professor & Head'
  },
  {
    employeeId: 'ACC001',
    email: 'ACC001@nmit.ac.in',
    password: 'demo123',
    name: 'Dr. Jennifer Wilson',
    role: 'accounts',
    designation: 'Accounts Officer'
  }
];

export const createDemoAuthUsers = async () => {
  const results = [];
  
  for (const demoUser of DEMO_USERS) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: demoUser.email,
        password: demoUser.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          employee_id: demoUser.employeeId,
          name: demoUser.name
        }
      });

      if (authError) {
        console.error(`Error creating auth user for ${demoUser.employeeId}:`, authError);
        results.push({ employeeId: demoUser.employeeId, success: false, error: authError.message });
        continue;
      }

      // Update the user profile with auth_user_id
      const { error: updateError } = await supabase
        .from('users')
        .update({ auth_user_id: authData.user.id })
        .eq('employee_id', demoUser.employeeId);

      if (updateError) {
        console.error(`Error updating user profile for ${demoUser.employeeId}:`, updateError);
        results.push({ employeeId: demoUser.employeeId, success: false, error: updateError.message });
      } else {
        results.push({ employeeId: demoUser.employeeId, success: true, authUserId: authData.user.id });
      }
    } catch (error) {
      console.error(`Unexpected error for ${demoUser.employeeId}:`, error);
      results.push({ employeeId: demoUser.employeeId, success: false, error: 'Unexpected error' });
    }
  }

  return results;
};

export const getDemoCredentialsInfo = () => {
  return {
    faculty: [
      { email: 'FAC001@nmit.ac.in', password: 'demo123', name: 'Dr. John Smith (CSE Faculty)' },
      { email: 'FAC002@nmit.ac.in', password: 'demo123', name: 'Dr. Emily Davis (ECE Faculty)' }
    ],
    hod: [
      { email: 'HOD001@nmit.ac.in', password: 'demo123', name: 'Dr. Sarah Johnson (CSE HoD)' },
      { email: 'HOD002@nmit.ac.in', password: 'demo123', name: 'Dr. Robert Wilson (ECE HoD)' }
    ],
    admin: [
      { email: 'ADM001@nmit.ac.in', password: 'demo123', name: 'Dr. Michael Brown (Faculty Development Cell)' }
    ],
    accounts: [
      { email: 'ACC001@nmit.ac.in', password: 'demo123', name: 'Dr. Jennifer Wilson (Accounts)' }
    ]
  };
};
