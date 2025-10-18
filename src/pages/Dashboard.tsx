
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModernStatsCard } from '@/components/dashboard/ModernStatsCard';
import { ModernBarChart } from '@/components/dashboard/ModernBarChart';
import { ModernPieChart } from '@/components/dashboard/ModernPieChart';
import { submissionService } from '@/services/submissionService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  TrendingUp, 
  Clock, 
  Users,
  Plus,
  BarChart3,
  PieChart,
  Calendar
} from 'lucide-react';
import type { Submission } from '@/types';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch submissions based on user role
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['dashboard-submissions', user?.role, user?.department],
    queryFn: async () => {
      if (!user) return [];
      

      
      if (user.role === 'faculty') {
        const response = await submissionService.getMySubmissions();
        return response.data || [];
      } else if (user.role === 'hod') {
        // For HoD, get all submissions from all departments
        const response = await submissionService.getAllSubmissions();
        if (response.error) {
          console.error('Error fetching HoD dashboard submissions:', response.error);
          return [];
        }


        return response.data || [];
      } else if (user.role === 'admin') {
        const response = await submissionService.getAllSubmissions();
        return response.data || [];
      }
      
      return [];
    },
    enabled: !!user,
  });

  // Calculate statistics
  const totalSubmissions = submissions.length;
  const approvedSubmissions = submissions.filter(s => s.status === 'Approved by Accounts').length;
  const pendingSubmissions = submissions.filter(s => 
    s.status === 'Pending FDC Approval' || 
    s.status === 'Pending HoD Approval' || 
    s.status === 'Pending Accounts Approval' ||
    s.status === 'Approved by FDC' ||
    s.status === 'Approved by HoD'
  ).length;
  const rejectedSubmissions = submissions.filter(s => 
    s.status === 'Rejected by FDC' || 
    s.status === 'Rejected by HoD' || 
    s.status === 'Rejected by Accounts'
  ).length;

  // Calculate current and previous month's statistics for trend calculation
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const currentMonthSubmissions = submissions.filter(s => {
    const date = new Date(s.createdAt);
    return date >= currentMonthStart && date < now;
  });
  
  const previousMonthSubmissions = submissions.filter(s => {
    const date = new Date(s.createdAt);
    return date >= previousMonthStart && date < currentMonthStart;
  });

  // Calculate trends (percentage change from previous month)
  const calculateTrend = (currentCount: number, previousCount: number): number => {
    if (previousCount === 0) return currentCount > 0 ? 100 : 0;
    return Math.round(((currentCount - previousCount) / previousCount) * 100);
  };

  const totalTrend = calculateTrend(
    currentMonthSubmissions.length,
    previousMonthSubmissions.length
  );

  const approvedTrend = calculateTrend(
    currentMonthSubmissions.filter(s => s.status === 'Approved by Accounts').length,
    previousMonthSubmissions.filter(s => s.status === 'Approved by Accounts').length
  );

  const pendingTrend = calculateTrend(
    currentMonthSubmissions.filter(s => 
      s.status === 'Pending FDC Approval' || 
      s.status === 'Pending HoD Approval' || 
      s.status === 'Pending Accounts Approval' ||
      s.status === 'Approved by FDC' ||
      s.status === 'Approved by HoD'
    ).length,
    previousMonthSubmissions.filter(s => 
      s.status === 'Pending FDC Approval' || 
      s.status === 'Pending HoD Approval' || 
      s.status === 'Pending Accounts Approval' ||
      s.status === 'Approved by FDC' ||
      s.status === 'Approved by HoD'
    ).length
  );

  const rejectedTrend = calculateTrend(
    currentMonthSubmissions.filter(s => 
      s.status === 'Rejected by FDC' || 
      s.status === 'Rejected by HoD' || 
      s.status === 'Rejected by Accounts'
    ).length,
    previousMonthSubmissions.filter(s => 
      s.status === 'Rejected by FDC' || 
      s.status === 'Rejected by HoD' || 
      s.status === 'Rejected by Accounts'
    ).length
  );

  // Module distribution data
  const moduleData = [
    { 
      name: 'Programs Attended', 
      value: submissions.filter(s => s.moduleType === 'attended').length 
    },
    { 
      name: 'Programs Organized', 
      value: submissions.filter(s => s.moduleType === 'organized').length 
    },
    { 
      name: 'Certifications', 
      value: submissions.filter(s => s.moduleType === 'certification').length 
    }
  ];

  // Status distribution for pie chart
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
      const monthSubmissions = submissions.filter(s => {
        const subDate = new Date(s.createdAt);
        return subDate.getMonth() === date.getMonth() && 
               subDate.getFullYear() === date.getFullYear();
      }).length;
      
      months.push({ name: monthName, value: monthSubmissions });
    }
    
    return months;
  }, [submissions]);

  const getDashboardTitle = () => {
    switch (user?.role) {
      case 'faculty':
        return 'Faculty Dashboard';
      case 'hod':
        return `HoD Dashboard - ${user.department}`;
      case 'admin':
        return 'Faculty Development Cell Dashboard';
      default:
        return 'Dashboard';
    }
  };

  const getDashboardDescription = () => {
    switch (user?.role) {
      case 'faculty':
        return 'Track your professional development submissions and progress';
      case 'hod':
        return 'Monitor and manage all faculty submissions across departments';
      case 'admin':
        return 'Comprehensive overview of all institutional submissions';
      default:
        return 'Welcome to your dashboard';
    }
  };

  if (!user) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in</h2>
        <p className="text-gray-600">You need to be logged in to view the dashboard.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{getDashboardTitle()}</h1>
          <p className="text-muted-foreground mt-2">{getDashboardDescription()}</p>
        </div>
        <div className="flex gap-2">
          {user.role === 'faculty' && (
            <Button onClick={() => navigate('/submissions/new')} className="flex items-center gap-2">
              <Plus size={16} />
              New Submission
            </Button>
          )}
          {(['hod', 'admin'].includes(user.role)) && (
            <Button 
              variant="outline" 
              onClick={() => navigate('/reports')} 
              className="flex items-center gap-2"
            >
              <BarChart3 size={16} />
              View Reports
            </Button>
          )}
        </div>
      </div>

      {/* Login Welcome Message */}
              <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-blue-900 mb-2">Welcome back, {user.name}!</h3>
              <p className="text-blue-700">
                {user.role === 'faculty' 
                  ? "Track your professional development journey and submit new activities."
                  : user.role === 'hod'
                  ? "Manage and review all faculty submissions across departments."
                  : "Monitor and manage institutional professional development activities."}
              </p>
            </div>
            <Calendar className="h-12 w-12 text-blue-500" />
          </CardContent>
        </Card>

      {/* Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3">Loading dashboard...</span>
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
              trend={{ value: totalTrend, isPositive: totalTrend >= 0 }}
              icon={<FileText />}
              gradient="from-blue-500 to-blue-600"
            />
            <ModernStatsCard
              title="Approved"
              value={approvedSubmissions}
              trend={{ value: approvedTrend, isPositive: approvedTrend >= 0 }}
              icon={<TrendingUp />}
              gradient="from-green-500 to-green-600"
            />
            <ModernStatsCard
              title="Pending Review"
              value={pendingSubmissions}
              trend={{ value: pendingTrend, isPositive: pendingTrend < 0 }}
              icon={<Clock />}
              gradient="from-yellow-500 to-yellow-600"
            />
            <ModernStatsCard
              title={user.role === 'faculty' ? 'Rejected' : 'Active Users'}
              value={user.role === 'faculty' ? rejectedSubmissions : new Set(submissions.map(s => s.user?.id)).size}
              trend={{ value: user.role === 'faculty' ? rejectedTrend : 0, isPositive: user.role === 'faculty' ? rejectedTrend < 0 : true }}
              icon={<Users />}
              gradient="from-red-500 to-red-600"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 size={20} />
                  Monthly Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ModernBarChart data={monthlyData} />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart size={20} />
                  Status Overview
                </CardTitle>
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
                  <div key={module.name} className="text-center p-6 border rounded-lg hover:shadow-md transition-shadow">
                    <h3 className="text-2xl font-bold text-primary mb-2">{module.value}</h3>
                    <p className="text-muted-foreground">{module.name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar size={20} />
                Recent Submissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No submissions found</p>
                  {user.role === 'faculty' && (
                    <Button 
                      className="mt-4" 
                      onClick={() => navigate('/new-submission')}
                    >
                      Create Your First Submission
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.slice(0, 5).map((submission) => (
                    <div key={submission.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {submission.moduleType === 'certification' 
                              ? submission.formData?.courseName || 'Certification'
                              : submission.formData?.title || 'Untitled'
                            }
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {submission.user?.name} • {new Date(submission.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        submission.status === 'Approved by Accounts' ? 'default' :
                        submission.status.includes('Pending') || submission.status.includes('Approved by') ? 'secondary' : 'destructive'
                      }>
                        {submission.status}
                      </Badge>
                    </div>
                  ))}
                  {submissions.length > 5 && (
                    <div className="text-center pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => navigate(user.role === 'faculty' ? '/submissions' : '/all-submissions')}
                      >
                        View All Submissions
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
