import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeleteSubmissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export const DeleteSubmissionsModal: React.FC<DeleteSubmissionsModalProps> = ({
  open,
  onOpenChange,
  onDeleted,
}) => {
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const handlePreview = async () => {
    if (!timeRange) return;

    try {
      const cutoffDate = new Date();
      switch (timeRange) {
        case '1month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
        case '3months':
          cutoffDate.setMonth(cutoffDate.getMonth() - 3);
          break;
        case '6months':
          cutoffDate.setMonth(cutoffDate.getMonth() - 6);
          break;
        case '1year':
          cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
          break;
        case '2years':
          cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
          break;
      }

      const { count, error } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;

      setPreviewCount(count || 0);
    } catch (error: any) {
      toast({
        title: 'Preview Failed',
        description: error.message || 'Failed to preview submissions',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!timeRange || previewCount === null) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${previewCount} submissions? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const cutoffDate = new Date();
      switch (timeRange) {
        case '1month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
        case '3months':
          cutoffDate.setMonth(cutoffDate.getMonth() - 3);
          break;
        case '6months':
          cutoffDate.setMonth(cutoffDate.getMonth() - 6);
          break;
        case '1year':
          cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
          break;
        case '2years':
          cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
          break;
      }

      // First, get all submissions to delete their documents
      const { data: submissions, error: fetchError } = await supabase
        .from('submissions')
        .select('document_url')
        .lt('created_at', cutoffDate.toISOString());

      if (fetchError) throw fetchError;

      // Delete documents from storage
      if (submissions) {
        for (const submission of submissions) {
          if (submission.document_url) {
            try {
              await supabase.storage
                .from('submissions')
                .remove([submission.document_url]);
            } catch (err) {
              console.error('Error deleting document:', err);
            }
          }
        }
      }

      // Delete submissions from database
      const { error: deleteError } = await supabase
        .from('submissions')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (deleteError) throw deleteError;

      toast({
        title: 'Submissions Deleted',
        description: `Successfully deleted ${previewCount} submissions`,
      });

      setPreviewCount(null);
      setTimeRange('');
      onDeleted();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete submissions',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Delete Old Submissions
          </DialogTitle>
          <DialogDescription>
            Permanently delete submissions older than a specified time period to clean up the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  Warning: This action cannot be undone
                </p>
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  All submissions and their associated documents will be permanently deleted.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="timeRange">Select Time Period</Label>
            <Select value={timeRange} onValueChange={(value) => {
              setTimeRange(value);
              setPreviewCount(null);
            }}>
              <SelectTrigger id="timeRange">
                <SelectValue placeholder="Choose how far back to delete" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">Older than 1 month</SelectItem>
                <SelectItem value="3months">Older than 3 months</SelectItem>
                <SelectItem value="6months">Older than 6 months</SelectItem>
                <SelectItem value="1year">Older than 1 year</SelectItem>
                <SelectItem value="2years">Older than 2 years</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {previewCount !== null && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {previewCount} submission{previewCount !== 1 ? 's' : ''} will be deleted
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={!timeRange || isDeleting}
              className="flex-1"
            >
              Preview Count
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={previewCount === null || previewCount === 0 || isDeleting}
              className="flex-1"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
