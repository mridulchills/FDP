
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SubmissionsTable } from '@/components/submissions/SubmissionsTable';
import { SubmissionDetailsModal } from '@/components/submissions/SubmissionDetailsModal';
import { EditSubmissionModal } from '@/components/submissions/EditSubmissionModal';
import { submissionService } from '@/services/submissionService';
import { useToast } from '@/hooks/use-toast';
import { Search, Filter, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Submission, SubmissionStatus, ProgramAttendedData, ProgramOrganizedData, CertificationData } from '@/types';

export const MySubmissions: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: submissions = [], isLoading, error } = useQuery({
    queryKey: ['my-submissions'],
    queryFn: async () => {
      const { data, error } = await submissionService.getMySubmissions();
      if (error) throw error;
      return data || [];
    }
  });

  const getSubmissionTitle = (submission: Submission) => {
    const { formData, moduleType } = submission;
    if (moduleType === 'attended' || moduleType === 'organized') {
      return (formData as ProgramAttendedData | ProgramOrganizedData).title;
    } else if (moduleType === 'certification') {
      return (formData as CertificationData).courseName;
    }
    return 'Untitled';
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = getSubmissionTitle(submission)
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || submission.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleView = (submission: Submission) => {
    setSelectedSubmission(submission);
    setIsDetailsModalOpen(true);
  };

  const handleEdit = (submission: Submission) => {
    setEditingSubmission(submission);
    setIsEditModalOpen(true);
  };

  const handleDelete = (id: string, status: SubmissionStatus) => {
    if (status !== 'Pending HoD Approval') {
      toast({
        title: "Cannot Delete",
        description: "Only pending submissions can be deleted.",
        variant: "destructive",
      });
      return;
    }
    setDeletingSubmissionId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingSubmissionId) return;

    try {
      const { error } = await submissionService.deleteSubmission(deletingSubmissionId);
      if (error) throw error;

      toast({
        title: "Submission Deleted",
        description: "Your submission has been deleted successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete submission.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingSubmissionId(null);
    }
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setEditingSubmission(null);
    queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load submissions. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Submissions</h1>
          <p className="text-muted-foreground">
            Manage and track your professional development submissions
          </p>
        </div>
        <Button onClick={() => navigate('/submissions/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Submission
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search submissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending HoD Approval">Pending HoD Approval</SelectItem>
            <SelectItem value="Approved by HoD">Approved by HoD</SelectItem>
            <SelectItem value="Rejected by HoD">Rejected by HoD</SelectItem>
            <SelectItem value="Approved by Admin">Approved by Admin</SelectItem>
            <SelectItem value="Rejected by Admin">Rejected by Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Submissions Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <p>Loading submissions...</p>
        </div>
      ) : (
        <SubmissionsTable
          submissions={filteredSubmissions}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      )}

      {/* Modals */}
      <SubmissionDetailsModal
        submission={selectedSubmission}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedSubmission(null);
        }}
      />

      <EditSubmissionModal
        submission={editingSubmission}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSubmission(null);
        }}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this submission? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
