import { supabase } from '@/integrations/supabase/client';
import type { ModuleType, Submission } from '@/types';
import type { DatabaseSubmission } from '@/types/database';
import { transformDatabaseSubmission } from '@/utils/transformers';

export interface CreateSubmissionData {
  moduleType: ModuleType;
  formData: any;
  documentUrl?: string;
}

export const submissionService = {
  async createSubmission(data: CreateSubmissionData): Promise<{ data: Submission | null; error: any }> {
    try {
      // Get current user ID from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userError || !userData) {

        throw new Error('User not found');
      }



      // First create the submission to get the submission ID
      const { data: submission, error } = await supabase
        .from('submissions')
        .insert({
          user_id: userData.id,
          module_type: data.moduleType,
          form_data: data.formData,
          document_url: null, // We'll update this after moving the file
          status: 'Pending FDC Approval'
        })
        .select(`
          *,
          user:users(*)
        `)
        .single();

      if (error) {

        return { data: null, error };
      }

      // If there's a document URL, move the file from temp to the submission folder
      let finalDocumentUrl = data.documentUrl;
      if (data.documentUrl && data.documentUrl.includes('/temp/')) {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            // Extract the filename from the temp path
            const fileName = data.documentUrl.split('/').pop();
            const newFilePath = `${authUser.id}/${submission.id}/${fileName}`;
            
            // Move the file from temp to submission folder
            const { error: moveError } = await supabase.storage
              .from('submissions')
              .move(data.documentUrl, newFilePath);

            if (!moveError) {
              finalDocumentUrl = newFilePath;
            } else {

            }
          }
        } catch (moveError) {

          // Continue with original path if move fails
        }
      }

      // Update the submission with the final document URL
      if (finalDocumentUrl) {
        const { data: updatedSubmission, error: updateError } = await supabase
          .from('submissions')
          .update({ document_url: finalDocumentUrl })
          .eq('id', submission.id)
          .select(`
            *,
            user:users(*)
          `)
          .single();

        if (!updateError) {
          return { 
            data: transformDatabaseSubmission(updatedSubmission as DatabaseSubmission), 
            error: null 
          };
        }
      }

      return { 
        data: transformDatabaseSubmission(submission as DatabaseSubmission), 
        error: null 
      };
    } catch (error) {

      return { data: null, error };
    }
  },

  async getMySubmissions(): Promise<{ data: Submission[] | null; error: any }> {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userError || !userData) {
        throw new Error('User not found');
      }

      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          user:users(*)
        `)
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error };
      }

      const transformedSubmissions = data?.map(submission => 
        transformDatabaseSubmission(submission as DatabaseSubmission)
      ) || [];

      return { data: transformedSubmissions, error: null };
    } catch (error) {

      return { data: null, error };
    }
  },

  async getDepartmentSubmissions(): Promise<{ data: Submission[] | null; error: any }> {
    try {
      // Get current user's department first
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('department_id')
        .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userError || !userData) {
        throw new Error('User not found');
      }

      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          user:users!inner(
            *,
            department:departments!users_department_id_fkey(*)
          )
        `)
        .eq('users.department_id', userData.department_id)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error };
      }

      const transformedSubmissions = data?.map(submission => 
        transformDatabaseSubmission(submission as DatabaseSubmission)
      ) || [];

      return { data: transformedSubmissions, error: null };
    } catch (error) {

      return { data: null, error };
    }
  },

  async getAllSubmissions(): Promise<{ data: Submission[] | null; error: any }> {
    try {
      // Get current user's role and department
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, department_id')
        .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userError || !userData) {
        throw new Error('User not found');
      }

      let query = supabase
        .from('submissions')
        .select(`
          *,
          user:users(
            *,
            department:departments!users_department_id_fkey(*)
          )
        `)
        .order('created_at', { ascending: false });

      // If user is HoD, filter by their department
      if (userData.role === 'hod') {
        query = query.eq('users.department_id', userData.department_id);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error };
      }

      const transformedSubmissions = data?.map(submission => 
        transformDatabaseSubmission(submission as DatabaseSubmission)
      ) || [];

      return { data: transformedSubmissions, error: null };
    } catch (error) {

      return { data: null, error };
    }
  },

  async updateSubmission(id: string, updates: Partial<Submission>): Promise<{ data: Submission | null; error: any }> {
    try {
      // Convert camelCase updates back to snake_case for database
      const dbUpdates: any = {};
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.hodComment !== undefined) dbUpdates.hod_comment = updates.hodComment;
      if (updates.fdcComment !== undefined) dbUpdates.fdc_comment = updates.fdcComment;
      if (updates.accountsComment !== undefined) dbUpdates.accounts_comment = updates.accountsComment;
      if (updates.documentUrl !== undefined) dbUpdates.document_url = updates.documentUrl;
      if (updates.formData) dbUpdates.form_data = updates.formData;

      const { data, error } = await supabase
        .from('submissions')
        .update(dbUpdates)
        .eq('id', id)
        .select(`
          *,
          user:users(*)
        `)
        .single();

      if (error) {
        return { data: null, error };
      }

      return { 
        data: transformDatabaseSubmission(data as DatabaseSubmission), 
        error: null 
      };
    } catch (error) {

      return { data: null, error };
    }
  },

  async deleteSubmission(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {

      return { error };
    }
  },

  async getSubmissionById(id: string): Promise<{ data: Submission | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          user:users(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        return { data: null, error };
      }

      return { 
        data: transformDatabaseSubmission(data as DatabaseSubmission), 
        error: null 
      };
    } catch (error) {

      return { data: null, error };
    }
  }
};
