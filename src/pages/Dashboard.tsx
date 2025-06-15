
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
          <div className="grid gap-10 lg:grid-cols-3">
            {/* Quick Actions Card */}
            <Card className="lg:col-span-1 min-h-[320px] shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-4 text-2xl font-bold text-gray-900">
                  <div className="p-3 bg-blue-100 rounded-2xl">
                    <Plus className="w-7 h-7 text-blue-600" />
                  </div>
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Manage your submissions efficiently
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-0">
                <Link to="/submissions/new">
                  <Button className="w-full justify-start py-4 px-8 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 text-white font-semibold shadow-lg text-base">
                    <FileText className="w-6 h-6 mr-4" />
                    New Submission
                  </Button>
                </Link>
                <Link to="/submissions">
                  <Button variant="outline" className="w-full justify-start py-4 px-8 rounded-2xl hover:bg-blue-50 border-2 border-blue-200 text-blue-700 font-semibold transition-all duration-200 transform hover:scale-105 text-base">
                    <Clock className="w-6 h-6 mr-4" />
                    My Submissions
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Submission Status Chart */}
            <Card className="lg:col-span-1 min-h-[500px] shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900">Submission Status</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Current status overview
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernPieChart 
                  data={pieData} 
                  total={stats?.totalSubmissions || 0}
                  height={400} 
                />
              </CardContent>
            </Card>

            {/* Activity by Module Chart */}
            <Card className="lg:col-span-1 min-h-[500px] shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900">Activity by Module</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Your submissions breakdown
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernBarChart 
                  data={stats?.moduleData || []} 
                  height={400} 
                  color="#3b82f6" 
                />
              </CardContent>
            </Card>
          </div>
        );

      case 'hod':
        return (
          <div className="grid gap-10 lg:grid-cols-3">
            {/* Pending Reviews Card */}
            <Card className="lg:col-span-1 min-h-[320px] shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-gradient-to-br from-amber-50 via-white to-orange-50 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-4 text-2xl font-bold text-gray-900">
                  <div className="p-3 bg-amber-100 rounded-2xl">
                    <Clock className="w-7 h-7 text-amber-600" />
                  </div>
                  Pending Reviews
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Submissions awaiting your approval
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link to="/approvals">
                  <Button className="w-full py-4 px-8 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 transition-all duration-200 transform hover:scale-105 text-white font-semibold shadow-lg text-base">
                    Review Submissions ({stats?.pendingApprovals || 0})
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Department Overview Chart */}
            <Card className="lg:col-span-1 min-h-[500px] shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900">Department Overview</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Department submission status
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernPieChart 
                  data={pieData} 
                  total={stats?.totalSubmissions || 0}
                  height={400} 
                />
              </CardContent>
            </Card>

            {/* Monthly Trends Chart */}
            <Card className="lg:col-span-1 min-h-[500px] shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900">Monthly Trends</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Department activity trends
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernBarChart 
                  data={stats?.moduleData || []} 
                  height={400} 
                  color="#059669" 
                />
              </CardContent>
            </Card>
          </div>
        );

      case 'admin':
        return (
          <div className="grid gap-10 lg:grid-cols-4">
            {/* System Overview Card */}
            <Card className="min-h-[320px] shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-gradient-to-br from-purple-50 via-white to-indigo-50 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-4 text-xl font-bold text-gray-900">
                  <div className="p-3 bg-purple-100 rounded-2xl">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  System Overview
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Administrative actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <Link to="/approvals">
                  <Button className="w-full justify-start py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transition-all duration-200 transform hover:scale-105 text-white font-semibold shadow-lg text-base">
                    <Clock className="w-5 h-5 mr-3" />
                    Final Approvals
                  </Button>
                </Link>
                <Link to="/users">
                  <Button variant="outline" className="w-full justify-start py-4 px-6 rounded-2xl hover:bg-purple-50 border-2 border-purple-200 text-purple-700 font-semibold transition-all duration-200 transform hover:scale-105 text-base">
                    <Users className="w-5 h-5 mr-3" />
                    Manage Users
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* All Submissions Chart */}
            <Card className="min-h-[500px] shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-bold text-gray-900">All Submissions</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Institution-wide overview
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

            {/* Department Activity Chart */}
            <Card className="min-h-[500px] shadow-xl hover:shadow-2xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-bold text-gray-900">Department Activity</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Cross-department trends
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ModernBarChart 
                  data={stats?.moduleData || []} 
                  height={300} 
                  color="#7c3aed" 
                />
              </CardContent>
            </Card>

            {/* System Reports Card */}
            <Card className="min-h-[320px] shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-gradient-to-br from-emerald-50 via-white to-green-50 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-4 text-xl font-bold text-gray-900">
                  <div className="p-3 bg-emerald-100 rounded-2xl">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                  System Reports
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Analytics & insights
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link to="/reports">
                  <Button className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 transform hover:scale-105 text-white font-semibold shadow-lg text-base">
                    <Calendar className="w-5 h-5 mr-3" />
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
    <div className="space-y-10 animate-fade-in">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-3xl p-10 text-white shadow-2xl">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Welcome back, {user?.name}
        </h1>
        <p className="text-blue-100 text-lg opacity-90 font-medium">
          {user?.designation} • {user?.department} • {user?.institution}
        </p>
      </div>

      {/* Enhanced Stats Overview */}
      <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <ModernStatsCard
          title="Total Submissions"
          value={stats?.totalSubmissions || 0}
          icon={<FileText className="w-8 h-8 text-white" />}
          gradient="from-blue-500 to-blue-600"
          trend={stats?.thisMonth && stats?.lastMonth ? {
            value: Math.round(((stats.thisMonth - stats.lastMonth) / (stats.lastMonth || 1)) * 100),
            isPositive: stats.thisMonth >= stats.lastMonth
          } : undefined}
        />
        <ModernStatsCard
          title="Pending Approvals"
          value={stats?.pendingApprovals || 0}
          icon={<Clock className="w-8 h-8 text-white" />}
          gradient="from-amber-500 to-orange-500"
        />
        <ModernStatsCard
          title="Approved"
          value={stats?.approved || 0}
          icon={<CheckCircle className="w-8 h-8 text-white" />}
          gradient="from-emerald-500 to-green-500"
        />
        <ModernStatsCard
          title="This Month"
          value={stats?.thisMonth || 0}
          icon={<TrendingUp className="w-8 h-8 text-white" />}
          gradient="from-purple-500 to-indigo-500"
        />
      </div>

      {/* Role-specific content */}
      {getRoleSpecificContent()}
    </div>
  );
};
