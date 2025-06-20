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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Search, Filter, Download, FileText, Users } from 'lucide-react';
import type { Submission } from '@/types';

// Helper function to get title from different form data types
const getSubmissionTitle = (submission: Submission): string => {
  if (submission.moduleType === 'certification') {
    return submission.formData?.courseName || 'Certification';
  } else {
    return submission.formData?.title || 'Untitled';
  }
};

export const AllSubmissions: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  const { data: submissions = [], isLoading, refetch } = useQuery({
    queryKey: ['all-submissions'],
    queryFn: async () => {
      const response = await submissionService.getAllSubmissions();
      return response.data || [];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Filter submissions based on user role
  const roleFilteredSubmissions = submissions.filter((submission) => {
    if (user?.role === 'admin') {
      return true; // Admin can see all submissions
    } else if (user?.role === 'hod') {
      // HoD can only see submissions from their department
      return submission.user?.department === user.department;
    }
    return false; // Other roles shouldn't access this page
  });

  const filteredSubmissions = roleFilteredSubmissions.filter((submission) => {
    const title = getSubmissionTitle(submission);
    const matchesSearch = submission.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         submission.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || submission.status === statusFilter;
    const matchesModule = moduleFilter === 'all' || submission.moduleType === moduleFilter;
    // Fixed: Use department name instead of department_id for filtering
    const matchesDepartment = departmentFilter === 'all' || 
      departments.find(dept => dept.id === departmentFilter)?.name === submission.user?.department;
    
    return matchesSearch && matchesStatus && matchesModule && matchesDepartment;
  });

  const handleExportData = () => {
    try {
      const csvContent = [
        ['Title', 'Faculty Name', 'Module Type', 'Status', 'Created Date', 'Department'].join(','),
        ...filteredSubmissions.map(submission => [
          getSubmissionTitle(submission),
          submission.user?.name || 'N/A',
          submission.moduleType,
          submission.status,
          new Date(submission.createdAt).toLocaleDateString(),
          submission.user?.department || 'N/A'
        ].map(field => `"${field}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `submissions-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Submissions data has been exported to CSV.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleView = (submission: Submission) => {
    setSelectedSubmission(submission);
  };

  const handleEdit = (submission: Submission) => {
    console.log('Edit submission:', submission.id);
    toast({
      title: "Feature Coming Soon",
      description: "Edit functionality will be available in the next update.",
    });
  };

  const handleDelete = (id: string, status: any) => {
    console.log('Delete submission:', id);
    toast({
      title: "Feature Coming Soon",
      description: "Delete functionality will be available in the next update.",
    });
  };

  if (!user || !['hod', 'admin'].includes(user.role)) {
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
        <div className="flex items-center gap-3">
          <FileText size={32} className="text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Submissions</h1>
            <p className="text-muted-foreground">
              {user.role === 'admin' 
                ? 'View and manage all faculty submissions' 
                : 'View submissions from your department'
              }
            </p>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by faculty name, title, or ID..."
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

            {user.role === 'admin' && (
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users size={14} />
                {filteredSubmissions.length} Results
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3">Loading submissions...</span>
            </div>
          </CardContent>
        </Card>
      ) : filteredSubmissions.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No submissions found</h3>
              <p className="text-sm">
                {searchTerm || statusFilter !== 'all' || moduleFilter !== 'all' || departmentFilter !== 'all'
                  ? 'Try adjusting your search criteria'
                  : 'No submissions have been made yet'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <SubmissionsTable
          submissions={filteredSubmissions}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      )}

      {/* Submission Details Modal */}
      {selectedSubmission && (
        <SubmissionDetailsModal
          submission={selectedSubmission}
          isOpen={!!selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  );
};
