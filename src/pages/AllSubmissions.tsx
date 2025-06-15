
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubmissionsTable } from '@/components/submissions/SubmissionsTable';
import { SubmissionDetailsModal } from '@/components/submissions/SubmissionDetailsModal';
import { submissionService } from '@/services/submissionService';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Filter, Download } from 'lucide-react';
import type { Submission } from '@/types';

export const AllSubmissions: React.FC = () => {
  const { user } = useAuth();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const { data: submissions = [], isLoading, refetch } = useQuery({
    queryKey: ['all-submissions'],
    queryFn: () => submissionService.getAllSubmissions(),
    select: (response) => response.data || [],
  });

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesSearch = submission.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         submission.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || submission.status === statusFilter;
    const matchesModule = moduleFilter === 'all' || submission.moduleType === moduleFilter;
    
    return matchesSearch && matchesStatus && matchesModule;
  });

  const handleExportData = () => {
    // Implementation for exporting data
    console.log('Exporting submissions data...');
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Submissions</h1>
          <p className="text-muted-foreground">View and manage all faculty submissions</p>
        </div>
        <Button onClick={handleExportData} className="flex items-center gap-2">
          <Download size={16} />
          Export Data
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter size={20} />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by faculty name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending HoD Approval">Pending HoD Approval</SelectItem>
                <SelectItem value="Approved by HoD">Approved by HoD</SelectItem>
                <SelectItem value="Rejected by HoD">Rejected by HoD</SelectItem>
                <SelectItem value="Approved by Admin">Approved by Admin</SelectItem>
                <SelectItem value="Rejected by Admin">Rejected by Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="attended">Programs Attended</SelectItem>
                <SelectItem value="organized">Programs Organized</SelectItem>
                <SelectItem value="certification">Certifications</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Badge variant="outline">{filteredSubmissions.length} Results</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <SubmissionsTable
        submissions={filteredSubmissions}
        isLoading={isLoading}
        onViewDetails={setSelectedSubmission}
        showActions={true}
        onRefresh={refetch}
      />

      {/* Submission Details Modal */}
      {selectedSubmission && (
        <SubmissionDetailsModal
          submission={selectedSubmission}
          isOpen={!!selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onUpdate={refetch}
        />
      )}
    </div>
  );
};
