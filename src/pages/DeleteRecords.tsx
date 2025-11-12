import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const DeleteRecords: React.FC = () => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [timeRange, setTimeRange] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deleteCount, setDeleteCount] = useState<number>(0);

  const timeRanges = [
    { value: '1', label: '1 Month' },
    { value: '3', label: '3 Months' },
    { value: '6', label: '6 Months' },
    { value: '12', label: '1 Year' },
    { value: '24', label: '2 Years' },
  ];

  const handleCheckDeleteCount = async () => {
    if (!timeRange) {
      toast({
        title: "Select Time Range",
        description: "Please select a time range before checking.",
        variant: "destructive",
      });
      return;
    }

    try {
      const months = parseInt(timeRange);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      const { count, error } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;

      setDeleteCount(count || 0);
      
      if (count === 0) {
        toast({
          title: "No Records Found",
          description: `No submissions older than ${timeRanges.find(r => r.value === timeRange)?.label}.`,
        });
      } else {
        setShowConfirmDialog(true);
      }
    } catch (error: any) {
      console.error('Error checking delete count:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to check records count.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRecords = async () => {
    if (!timeRange) return;

    setIsDeleting(true);
    try {
      const months = parseInt(timeRange);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      // First, fetch all submissions to delete their documents
      const { data: submissionsToDelete, error: fetchError } = await supabase
        .from('submissions')
        .select('document_url, form_data')
        .lt('created_at', cutoffDate.toISOString());

      if (fetchError) throw fetchError;

      // Delete documents from storage
      if (submissionsToDelete && submissionsToDelete.length > 0) {
        const documentPaths: string[] = [];
        
        submissionsToDelete.forEach(submission => {
          // Extract main document path
          if (submission.document_url) {
            const urlParts = submission.document_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const pathMatch = submission.document_url.match(/submissions\/(.+)/);
            if (pathMatch) {
              documentPaths.push(pathMatch[1]);
            }
          }

          // Extract additional document paths from form_data
          if (submission.form_data && Array.isArray((submission.form_data as any).documentUrls)) {
            (submission.form_data as any).documentUrls.forEach((doc: any) => {
              if (doc.path) {
                documentPaths.push(doc.path);
              }
            });
          }
        });

        // Delete files from storage
        if (documentPaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('submissions')
            .remove(documentPaths);

          if (storageError) {
            console.error('Error deleting files from storage:', storageError);
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
        title: "Records Deleted",
        description: `Successfully deleted ${deleteCount} submission(s) older than ${timeRanges.find(r => r.value === timeRange)?.label}.`,
      });

      setShowConfirmDialog(false);
      setTimeRange('');
      setDeleteCount(0);
    } catch (error: any) {
      console.error('Error deleting records:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete records.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="bg-destructive/10 text-destructive p-3 rounded-full flex-shrink-0">
          <Trash2 size={24} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Delete Records</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Remove old submissions to clear database space</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Old Submissions
          </CardTitle>
          <CardDescription>
            Select a time range to delete all submissions older than the specified period.
            This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Time Range</label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger>
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                {timeRanges.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    Older than {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-foreground">Warning</p>
                <p className="text-muted-foreground">
                  This will permanently delete all submissions and their associated documents
                  that were created before the selected time period. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
            <Button
              variant="destructive"
              onClick={handleCheckDeleteCount}
              disabled={!timeRange || isDeleting}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Check & Delete Records
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to delete <strong>{deleteCount}</strong> submission(s) older than{' '}
                <strong>{timeRanges.find(r => r.value === timeRange)?.label}</strong>.
              </p>
              <p className="text-destructive font-medium">
                This action cannot be undone. All associated documents will also be deleted.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRecords}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete {deleteCount} Record(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
