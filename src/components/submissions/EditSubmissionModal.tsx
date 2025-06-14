
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProgramAttendedForm } from '@/components/forms/ProgramAttendedForm';
import { submissionService } from '@/services/submissionService';
import { useToast } from '@/hooks/use-toast';
import type { Submission } from '@/types';

interface EditSubmissionModalProps {
  submission: Submission | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditSubmissionModal: React.FC<EditSubmissionModalProps> = ({
  submission,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { toast } = useToast();

  const handleSubmit = async (formData: any) => {
    if (!submission) return;

    try {
      const { error } = await submissionService.updateSubmission(submission.id, {
        formData,
        documentUrl: formData.documentUrl
      });

      if (error) throw error;

      toast({
        title: "Submission Updated",
        description: "Your submission has been updated successfully.",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update submission.",
        variant: "destructive",
      });
    }
  };

  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Submission</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {submission.moduleType === 'attended' && (
            <ProgramAttendedForm
              onSubmit={handleSubmit}
              initialData={submission.formData}
              isSubmitting={false}
              submitButtonText="Update Submission"
            />
          )}

          {submission.moduleType === 'organized' && (
            <div className="text-center py-8">
              <p className="text-gray-500">Edit form for organized programs coming soon...</p>
            </div>
          )}

          {submission.moduleType === 'certification' && (
            <div className="text-center py-8">
              <p className="text-gray-500">Edit form for certifications coming soon...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
