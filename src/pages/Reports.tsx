
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ModernStatsCard } from '@/components/dashboard/ModernStatsCard';
import { ModernBarChart } from '@/components/dashboard/ModernBarChart';
import { ModernPieChart } from '@/components/dashboard/ModernPieChart';
import { submissionService } from '@/services/submissionService';
import { supabase } from '@/integrations/supabase/client';
import { Download, Calendar, TrendingUp, Users, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Submission } from '@/types';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState('month');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Fetch all submissions
  const { data: allSubmissions = [], isLoading: loadingSubmissions } = useQuery({
    queryKey: ['reports-submissions'],
    queryFn: async () => {
      const response = await submissionService.getAllSubmissions();
      return response.data || [];
    },
  });

  // Fetch departments for admin dropdown
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
    enabled: user?.role === 'admin',
  });

  // Filter submissions based on role and selected department
  const filteredSubmissions = allSubmissions.filter((submission: Submission) => {
    if (user?.role === 'hod') {
      // HoD can only see their department's data
      return submission.user?.department === user.department;
    } else if (user?.role === 'admin') {
      // Admin can see all or filter by selected department
      if (selectedDepartment === 'all') {
        return true;
      } else {
        const selectedDept = departments.find(dept => dept.id === selectedDepartment);
        return submission.user?.department === selectedDept?.name;
      }
    }
    return false;
  });

  // Filter by timeframe
  const timeFilteredSubmissions = filteredSubmissions.filter((submission: Submission) => {
    const submissionDate = new Date(submission.createdAt);
    const now = new Date();
    
    switch (timeframe) {
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return submissionDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return submissionDate >= monthAgo;
      case 'quarter':
        const quarterAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        return submissionDate >= quarterAgo;
      case 'year':
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        return submissionDate >= yearAgo;
      default:
        return true;
    }
  });

  // Calculate statistics from real data
  const totalSubmissions = timeFilteredSubmissions.length;
  const approvedSubmissions = timeFilteredSubmissions.filter(s => s.status === 'Approved by Admin').length;
  const pendingSubmissions = timeFilteredSubmissions.filter(s => 
    s.status === 'Pending HoD Approval' || s.status === 'Approved by HoD'
  ).length;
  const rejectedSubmissions = timeFilteredSubmissions.filter(s => 
    s.status === 'Rejected by HoD' || s.status === 'Rejected by Admin'
  ).length;

  // Active users count (unique users who have submitted)
  const activeUsers = new Set(timeFilteredSubmissions.map(s => s.user?.id)).size;

  // Module distribution data
  const moduleData = [
    { 
      name: 'Programs Attended', 
      value: timeFilteredSubmissions.filter(s => s.moduleType === 'attended').length 
    },
    { 
      name: 'Programs Organized', 
      value: timeFilteredSubmissions.filter(s => s.moduleType === 'organized').length 
    },
    { 
      name: 'Certifications', 
      value: timeFilteredSubmissions.filter(s => s.moduleType === 'certification').length 
    }
  ];

  // Status distribution data
  const statusData = [
    { name: 'Approved', value: approvedSubmissions, color: '#00C49F' },
    { name: 'Pending', value: pendingSubmissions, color: '#FFBB28' },
    { name: 'Rejected', value: rejectedSubmissions, color: '#FF4C4C' }
  ];

  // Monthly trend data (last 6 months)
  const monthlyData = React.useMemo(() => {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const monthSubmissions = timeFilteredSubmissions.filter(s => {
        const subDate = new Date(s.createdAt);
        return subDate.getMonth() === date.getMonth() && 
               subDate.getFullYear() === date.getFullYear();
      }).length;
      
      months.push({ name: monthName, value: monthSubmissions });
    }
    
    return months;
  }, [timeFilteredSubmissions]);

  const handleExport = () => {
    try {
      const csvContent = [
        ['Period', 'Total Submissions', 'Approved', 'Pending', 'Rejected'].join(','),
        [
          timeframe.charAt(0).toUpperCase() + timeframe.slice(1),
          totalSubmissions,
          approvedSubmissions,
          pendingSubmissions,
          rejectedSubmissions
        ].map(field => `"${field}"`).join(',')
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `reports-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Report data has been exported to CSV.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!user || !['hod', 'admin'].includes(user.role)) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to view this page.</p>
      </div>
    );
  }

  const currentDepartmentName = user.role === 'hod' 
    ? user.department 
    : selectedDepartment === 'all' 
      ? 'All Departments' 
      : departments.find(d => d.id === selectedDepartment)?.name || 'Selected Department';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            {user.role === 'admin' 
              ? `Comprehensive reports and analytics - ${currentDepartmentName}` 
              : `Department reports and analytics - ${user.department}`
            }
          </p>
        </div>
        <Button onClick={handleExport} className="flex items-center gap-2">
          <Download size={16} />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger>
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>

            {user.role === 'admin' && (
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
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
                <Calendar size={14} />
                {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users size={14} />
                {totalSubmissions} Submissions
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loadingSubmissions ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3">Loading reports...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ModernStatsCard
              title="Total Submissions"
              value={totalSubmissions}
              trend={{ value: 12, isPositive: true }}
              icon={<FileText />}
              gradient="from-blue-500 to-blue-600"
            />
            <ModernStatsCard
              title="Approved"
              value={approvedSubmissions}
              trend={{ value: 8, isPositive: true }}
              icon={<TrendingUp />}
              gradient="from-green-500 to-green-600"
            />
            <ModernStatsCard
              title="Pending"
              value={pendingSubmissions}
              trend={{ value: 5, isPositive: false }}
              icon={<Calendar />}
              gradient="from-yellow-500 to-yellow-600"
            />
            <ModernStatsCard
              title="Active Users"
              value={activeUsers}
              trend={{ value: 15, isPositive: true }}
              icon={<Users />}
              gradient="from-purple-500 to-purple-600"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Submissions Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ModernBarChart data={monthlyData} />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ModernPieChart
                  data={statusData}
                  total={totalSubmissions}
                />
              </CardContent>
            </Card>
          </div>

          {/* Module Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Module Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {moduleData.map((module) => (
                  <div key={module.name} className="text-center p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">{module.value}</h3>
                    <p className="text-muted-foreground text-sm">{module.name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
