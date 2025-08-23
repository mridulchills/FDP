
import type { DatabaseSubmission, DatabaseUser } from '@/types/database';
import type { Submission, User, ModuleType, SubmissionStatus } from '@/types';

export const transformDatabaseUser = (dbUser: DatabaseUser): User => ({
  id: dbUser.id,
  employeeId: dbUser.employee_id,
  name: dbUser.name,
  email: dbUser.email,
  role: dbUser.role as 'faculty' | 'hod' | 'admin' | 'accounts',
  department: dbUser.department_id || '',
  designation: dbUser.designation,
  institution: dbUser.institution,
  createdAt: dbUser.created_at,
  updatedAt: dbUser.updated_at,
});

export const transformDatabaseSubmission = (dbSubmission: DatabaseSubmission): Submission => {
  const baseSubmission = {
    id: dbSubmission.id,
    userId: dbSubmission.user_id,
    moduleType: dbSubmission.module_type as ModuleType,
    status: dbSubmission.status as SubmissionStatus,
    documentUrl: dbSubmission.document_url || undefined,
    facultyDevelopmentCellComment: dbSubmission.faculty_development_cell_comment || dbSubmission.admin_comment || undefined,
    hodComment: dbSubmission.hod_comment || undefined,
    accountsComment: dbSubmission.accounts_comment || undefined,
    createdAt: dbSubmission.created_at,
    updatedAt: dbSubmission.updated_at,
    user: dbSubmission.user ? transformDatabaseUser(dbSubmission.user) : undefined,
    formData: dbSubmission.form_data,
  };

  // Return the submission with the correct discriminated union type
  return {
    ...baseSubmission,
    moduleType: dbSubmission.module_type as ModuleType,
    formData: dbSubmission.form_data,
  } as Submission;
};
