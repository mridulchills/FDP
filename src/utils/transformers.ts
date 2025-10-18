
import type { DatabaseSubmission, DatabaseUser } from '@/types/database';
import type { Submission, User, ModuleType, SubmissionStatus } from '@/types';

export const transformDatabaseUser = (dbUser: DatabaseUser): User => ({
  id: dbUser.id,
  employeeId: dbUser.employee_id,
  name: dbUser.name,
  email: dbUser.email,
  role: dbUser.role as 'faculty' | 'hod' | 'admin',
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
    hodComment: dbSubmission.hod_comment || undefined,
    fdcComment: (dbSubmission as any).fdc_comment || undefined,
    accountsComment: (dbSubmission as any).accounts_comment || undefined,
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
