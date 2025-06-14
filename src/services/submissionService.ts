
import { supabase } from '@/integrations/supabase/client';
import type { ModuleType, Submission } from '@/types';

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

      const { data: submission, error } = await supabase
        .from('submissions')
        .insert({
          user_id: userData.id,
          module_type: data.moduleType,
          form_data: data.formData,
          document_url: data.documentUrl || null,
          status: 'Pending HoD Approval'
        })
        .select()
        .single();

      return { data: submission, error };
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

      return { data, error };
    } catch (error) {
      console.error('Error fetching submissions:', error);
      return { data: null, error };
    }
  },

  async updateSubmission(id: string, updates: Partial<Submission>): Promise<{ data: Submission | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error updating submission:', error);
      return { data: null, error };
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

      return { data, error };
    } catch (error) {
      console.error('Error fetching submission:', error);
      return { data: null, error };
    }
  }
};
