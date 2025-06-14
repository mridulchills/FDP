
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit, Eye, Search, Filter, Plus } from 'lucide-react';
import { submissionService } from '@/services/submissionService';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import type { Submission, SubmissionStatus } from '@/types';
import { SubmissionDetailsModal } from '@/components/submissions/SubmissionDetailsModal';
import { EditSubmissionModal } from '@/components/submissions/EditSubmissionModal';
import { SubmissionsTable } from '@/components/submissions/SubmissionsTable';

export const MySubmissions: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: submissions, isLoading, error } = useQuery({
    queryKey: ['my-submissions'],
    queryFn: async () => {
      const { data, error } = await submissionService.getMySubmissions();
      if (error) throw error;
      return data || [];
    }
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await submissionService.deleteSubmission(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
      toast({
        title: "Submission Deleted",
        description: "Your submission has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete submission.",
        variant: "destructive",
      });
    }
  });

  const filteredSubmissions = submissions?.filter(submission => {
    const matchesSearch = submission.formData?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         submission.moduleType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || submission.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const handleViewDetails = (submission: Submission) => {
    setSelectedSubmission(submission);
    setIsDetailsModalOpen(true);
  };

  const handleEditSubmission = (submission: Submission) => {
    if (submission.status === 'Pending HoD Approval') {
      setEditingSubmission(submission);
      setIsEditModalOpen(true);
    } else {
      toast({
        title: "Cannot Edit",
        description: "Only pending submissions can be edited.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSubmission = (id: string, status: SubmissionStatus) => {
    if (status === 'Pending HoD Approval') {
      if (confirm('Are you sure you want to delete this submission?')) {
        deleteSubmissionMutation.mutate(id);
      }
    } else {
      toast({
        title: "Cannot Delete",
        description: "Only pending submissions can be deleted.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading submissions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2 text-red-600">Error Loading Submissions</h2>
            <p className="text-gray-600">Please try refreshing the page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Submissions</h1>
          <p className="text-muted-foreground">
            Track and manage your professional development submissions
          </p>
        </div>
        <Link to="/submissions/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Submission
          </Button>
        </Link>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search submissions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as SubmissionStatus | 'all')}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending HoD Approval">Pending HoD</SelectItem>
                  <SelectItem value="Approved by HoD">Approved by HoD</SelectItem>
                  <SelectItem value="Rejected by HoD">Rejected by HoD</SelectItem>
                  <SelectItem value="Approved by Admin">Approved by Admin</SelectItem>
                  <SelectItem value="Rejected by Admin">Rejected by Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Submissions ({filteredSubmissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <SubmissionsTable
            submissions={filteredSubmissions}
            onView={handleViewDetails}
            onEdit={handleEditSubmission}
            onDelete={handleDeleteSubmission}
            isLoading={deleteSubmissionMutation.isPending}
          />
        </CardContent>
      </Card>

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
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
          setIsEditModalOpen(false);
          setEditingSubmission(null);
        }}
      />
    </div>
  );
};
