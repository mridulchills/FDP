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
        console.error('User not found:', userError);
        throw new Error('User not found');
      }

      console.log('Creating submission for user:', userData.id);

      const { data: submission, error } = await supabase
        .from('submissions')
        .insert({
          user_id: userData.id,
          module_type: data.moduleType,
          form_data: data.formData,
          document_url: data.documentUrl || null,
          status: 'Pending HoD Approval'
        })
        .select(`
          *,
          user:users(*)
        `)
        .single();

      if (error) {
        console.error('Submission creation error:', error);
        return { data: null, error };
      }

      return { 
        data: transformDatabaseSubmission(submission as DatabaseSubmission), 
        error: null 
      };
    } catch (error) {
      console.error('Error creating submission:', error);
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
      console.error('Error fetching submissions:', error);
      return { data: null, error };
    }
  },

  async getDepartmentSubmissions(): Promise<{ data: Submission[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          user:users(
            *,
            department:departments!users_department_id_fkey(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error };
      }

      const transformedSubmissions = data?.map(submission => 
        transformDatabaseSubmission(submission as DatabaseSubmission)
      ) || [];

      return { data: transformedSubmissions, error: null };
    } catch (error) {
      console.error('Error fetching department submissions:', error);
      return { data: null, error };
    }
  },

  async getAllSubmissions(): Promise<{ data: Submission[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          user:users(
            *,
            department:departments!users_department_id_fkey(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error };
      }

      const transformedSubmissions = data?.map(submission => 
        transformDatabaseSubmission(submission as DatabaseSubmission)
      ) || [];

      return { data: transformedSubmissions, error: null };
    } catch (error) {
      console.error('Error fetching all submissions:', error);
      return { data: null, error };
    }
  },

  async updateSubmission(id: string, updates: Partial<Submission>): Promise<{ data: Submission | null; error: any }> {
    try {
      // Convert camelCase updates back to snake_case for database
      const dbUpdates: any = {};
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.hodComment !== undefined) dbUpdates.hod_comment = updates.hodComment;
      if (updates.adminComment !== undefined) dbUpdates.admin_comment = updates.adminComment;
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
      console.error('Error updating submission:', error);
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
      console.error('Error deleting submission:', error);
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
      console.error('Error fetching submission:', error);
      return { data: null, error };
    }
  }
};
