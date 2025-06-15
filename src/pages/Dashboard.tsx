
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Clock, CheckCircle, XCircle, TrendingUp, Users, Calendar } from 'lucide-react';
import { ModernStatsCard } from '@/components/dashboard/ModernStatsCard';
import { ModernPieChart } from '@/components/dashboard/ModernPieChart';
import { ModernBarChart } from '@/components/dashboard/ModernBarChart';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: submissions, error } = await supabase
        .from('submissions')
        .select('status, created_at, module_type')
        .eq('user_id', user.id);

      if (error) throw error;

      const total = submissions?.length || 0;
      const pending = submissions?.filter(s => s.status === 'Pending HoD Approval').length || 0;
      const approved = submissions?.filter(s => s.status.includes('Approved')).length || 0;
      const rejected = submissions?.filter(s => s.status.includes('Rejected')).length || 0;

      // This month submissions
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonth = submissions?.filter(s => new Date(s.created_at) >= startOfMonth).length || 0;

      // Last month submissions
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const lastMonth = submissions?.filter(s => {
        const date = new Date(s.created_at);
        return date >= startOfLastMonth && date <= endOfLastMonth;
      }).length || 0;

      // Module type counts
      const attended = submissions?.filter(s => s.module_type === 'attended').length || 0;
      const organized = submissions?.filter(s => s.module_type === 'organized').length || 0;
      const certification = submissions?.filter(s => s.module_type === 'certification').length || 0;

      return {
        totalSubmissions: total,
        pendingApprovals: pending,
        approved,
        rejected,
        thisMonth,
        lastMonth,
        moduleData: [
          { name: 'Programs Attended', value: attended },
          { name: 'Programs Organized', value: organized },
          { name: 'Certifications', value: certification },
        ]
      };
    },
    enabled: !!user
  });

  // Enhanced pie data with specified colors
  const pieData = [
    { name: 'Approved', value: stats?.approved || 0, color: '#00C49F' },
    { name: 'Pending Review', value: stats?.pendingApprovals || 0, color: '#FFBB28' },
    { name: 'Rejected', value: stats?.rejected || 0, color: '#FF4C4C' },
  ];

  const getRoleSpecificContent = () => {
    switch (user?.role) {
      case 'faculty':
        return (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Quick Actions Card */}
            <Card className="lg:col-span-1 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Plus className="w-5 h-5 text-blue-600" />
                  </div>
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Manage your submissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <Link to="/submissions/new">
                  <Button className="w-full justify-start py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 text-white font-medium shadow-md">
                    <FileText className="w-5 h-5 mr-3" />
                    New Submission
                  </Button>
                </Link>
                <Link to="/submissions">
                  <Button variant="outline" className="w-full justify-start py-3 px-6 rounded-xl hover:bg-blue-50 border-2 border-blue-200 text-blue-700 font-medium transition-all duration-200 transform hover:scale-105">
                    <Clock className="w-5 h-5 mr-3" />
                    My Submissions
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Submission Status Chart */}
            <Card className="lg:col-span-1 shadow-md hover:shadow-xl transition-all duration-300 border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-gray-900">Submission Status</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Current status overview
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernPieChart 
                  data={pieData} 
                  total={stats?.totalSubmissions || 0}
                  height={300} 
                />
              </CardContent>
            </Card>

            {/* Activity by Module Chart */}
            <Card className="lg:col-span-1 shadow-md hover:shadow-xl transition-all duration-300 border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-gray-900">Activity by Module</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Your submissions breakdown
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernBarChart 
                  data={stats?.moduleData || []} 
                  height={300} 
                  color="#3b82f6" 
                />
              </CardContent>
            </Card>
          </div>
        );

      case 'hod':
        return (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Pending Reviews Card */}
            <Card className="lg:col-span-1 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-amber-50 to-orange-50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <div className="p-2 bg-amber-100 rounded-full">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  Pending Reviews
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Submissions awaiting your approval
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link to="/approvals">
                  <Button className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 transition-all duration-200 transform hover:scale-105 text-white font-medium shadow-md">
                    Review Submissions ({stats?.pendingApprovals || 0})
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Department Overview Chart */}
            <Card className="lg:col-span-1 shadow-md hover:shadow-xl transition-all duration-300 border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-gray-900">Department Overview</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Department submission status
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernPieChart 
                  data={pieData} 
                  total={stats?.totalSubmissions || 0}
                  height={300} 
                />
              </CardContent>
            </Card>

            {/* Monthly Trends Chart */}
            <Card className="lg:col-span-1 shadow-md hover:shadow-xl transition-all duration-300 border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-gray-900">Monthly Trends</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Department activity trends
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernBarChart 
                  data={stats?.moduleData || []} 
                  height={300} 
                  color="#059669" 
                />
              </CardContent>
            </Card>
          </div>
        );

      case 'admin':
        return (
          <div className="grid gap-8 lg:grid-cols-4">
            {/* System Overview Card */}
            <Card className="shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-purple-50 to-indigo-50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900">
                  <div className="p-2 bg-purple-100 rounded-full">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  System Overview
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Administrative actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <Link to="/approvals">
                  <Button className="w-full justify-start py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transition-all duration-200 transform hover:scale-105 text-white font-medium shadow-md text-sm">
                    <Clock className="w-4 h-4 mr-2" />
                    Final Approvals
                  </Button>
                </Link>
                <Link to="/users">
                  <Button variant="outline" className="w-full justify-start py-3 px-4 rounded-xl hover:bg-purple-50 border-2 border-purple-200 text-purple-700 font-medium transition-all duration-200 transform hover:scale-105 text-sm">
                    <Users className="w-4 h-4 mr-2" />
                    Manage Users
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* All Submissions Chart */}
            <Card className="shadow-md hover:shadow-xl transition-all duration-300 border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-gray-900">All Submissions</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Institution-wide overview
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernPieChart 
                  data={pieData} 
                  total={stats?.totalSubmissions || 0}
                  height={220} 
                />
              </CardContent>
            </Card>

            {/* Department Activity Chart */}
            <Card className="shadow-md hover:shadow-xl transition-all duration-300 border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-gray-900">Department Activity</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Cross-department trends
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernBarChart 
                  data={stats?.moduleData || []} 
                  height={220} 
                  color="#7c3aed" 
                />
              </CardContent>
            </Card>

            {/* System Reports Card */}
            <Card className="shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-emerald-50 to-green-50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-bold text-gray-900">
                  <div className="p-2 bg-emerald-100 rounded-full">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  System Reports
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Analytics & insights
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link to="/reports">
                  <Button className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 transform hover:scale-105 text-white font-medium shadow-md text-sm">
                    <Calendar className="w-4 h-4 mr-2" />
                    Generate Reports
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  if (statsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Welcome back, {user?.name}
        </h1>
        <p className="text-blue-100 text-sm opacity-90">
          {user?.designation} • {user?.department} • {user?.institution}
        </p>
      </div>

      {/* Enhanced Stats Overview */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <ModernStatsCard
          title="Total Submissions"
          value={stats?.totalSubmissions || 0}
          icon={<FileText className="w-6 h-6 text-white" />}
          gradient="from-blue-500 to-blue-600"
          trend={stats?.thisMonth && stats?.lastMonth ? {
            value: Math.round(((stats.thisMonth - stats.lastMonth) / (stats.lastMonth || 1)) * 100),
            isPositive: stats.thisMonth >= stats.lastMonth
          } : undefined}
        />
        <ModernStatsCard
          title="Pending Approvals"
          value={stats?.pendingApprovals || 0}
          icon={<Clock className="w-6 h-6 text-white" />}
          gradient="from-amber-500 to-orange-500"
        />
        <ModernStatsCard
          title="Approved"
          value={stats?.approved || 0}
          icon={<CheckCircle className="w-6 h-6 text-white" />}
          gradient="from-emerald-500 to-green-500"
        />
        <ModernStatsCard
          title="This Month"
          value={stats?.thisMonth || 0}
          icon={<TrendingUp className="w-6 h-6 text-white" />}
          gradient="from-purple-500 to-indigo-500"
        />
      </div>

      {/* Role-specific content */}
      {getRoleSpecificContent()}
    </div>
  );
};
