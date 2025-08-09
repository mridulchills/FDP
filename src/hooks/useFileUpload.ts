
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface UploadResult {
  url: string;
  path: string;
}

export const useFileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const uploadFile = async (file: File, submissionId?: string): Promise<UploadResult | null> => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to upload files.",
        variant: "destructive",
      });
      return null;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a PDF, DOC, DOCX, JPG, or PNG file.",
        variant: "destructive",
      });
      return null;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      return null;
    }

    setUploading(true);

    try {
      // Get the current user's auth_user_id from auth context
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      // CRITICAL: Use the correct path structure for RLS policies
      // Format: {auth_user_id}/{submission_id_or_temp}/{filename}
      const folder = submissionId || 'temp';
      const filePath = `${authUser.id}/${folder}/${fileName}`;



      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, file);

      if (uploadError) {

        throw uploadError;
      }

      toast({
        title: "Upload Successful",
        description: "Your file has been uploaded successfully.",
      });

      return {
        url: filePath, // Store the path for database
        path: filePath
      };
    } catch (error: any) {

      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (filePath: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from('submissions')
        .remove([filePath]);

      if (error) {
        throw error;
      }

      toast({
        title: "File Deleted",
        description: "The file has been deleted successfully.",
      });

      return true;
    } catch (error: any) {

      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete file. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    try {


      // Use the file path as-is since it's already in the correct format
      const { data, error } = await supabase.storage
        .from('submissions')
        .createSignedUrl(filePath, 600); // 10 minutes expiry

      if (error) {

        throw error;
      }

      return data.signedUrl;
    } catch (error: any) {

      toast({
        title: "Access Failed",
        description: "Failed to load document. You may not have access or the file is missing.",
        variant: "destructive",
      });
      return null;
    }
  };

  return {
    uploadFile,
    deleteFile,
    getSignedUrl,
    uploading
  };
};
