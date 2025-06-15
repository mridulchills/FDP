
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Clock, CheckCircle, XCircle, TrendingUp, Users, Calendar, ArrowRight } from 'lucide-react';
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
    { name: 'Approved', value: stats?.approved || 0, color: '#10b981' },
    { name: 'Pending Review', value: stats?.pendingApprovals || 0, color: '#f59e0b' },
    { name: 'Rejected', value: stats?.rejected || 0, color: '#ef4444' },
  ];

  const getRoleSpecificContent = () => {
    switch (user?.role) {
      case 'faculty':
        return (
          <div className="space-y-8">
            {/* Charts Section */}
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Submission Status Chart */}
              <Card className="bg-white rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900">Submission Status</CardTitle>
                      <CardDescription className="text-gray-500">Current status overview</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-6">
                  <ModernPieChart 
                    data={pieData} 
                    total={stats?.totalSubmissions || 0}
                    height={350} 
                  />
                </CardContent>
              </Card>

              {/* Activity by Module Chart */}
              <Card className="bg-white rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900">Activity by Module</CardTitle>
                      <CardDescription className="text-gray-500">Your submissions breakdown</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ModernBarChart 
                    data={stats?.moduleData || []} 
                    height={400} 
                    color="#8b5cf6" 
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'hod':
        return (
          <div className="space-y-8">
            {/* Charts Section */}
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Department Overview Chart */}
              <Card className="bg-white rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900">Department Overview</CardTitle>
                      <CardDescription className="text-gray-500">Department submission status</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-6">
                  <ModernPieChart 
                    data={pieData} 
                    total={stats?.totalSubmissions || 0}
                    height={350} 
                  />
                </CardContent>
              </Card>

              {/* Monthly Trends Chart */}
              <Card className="bg-white rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900">Monthly Trends</CardTitle>
                      <CardDescription className="text-gray-500">Department activity trends</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ModernBarChart 
                    data={stats?.moduleData || []} 
                    height={400} 
                    color="#f59e0b" 
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'admin':
        return (
          <div className="space-y-8">
            {/* Charts Section */}
            <div className="grid gap-8 lg:grid-cols-3">
              {/* All Submissions Chart */}
              <Card className="bg-white rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900">All Submissions</CardTitle>
                      <CardDescription className="text-gray-500">Institution-wide overview</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <ModernPieChart 
                    data={pieData} 
                    total={stats?.totalSubmissions || 0}
                    height={280} 
                  />
                </CardContent>
              </Card>

              {/* Department Activity Chart */}
              <Card className="bg-white rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900">Department Activity</CardTitle>
                      <CardDescription className="text-gray-500">Cross-department trends</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ModernBarChart 
                    data={stats?.moduleData || []} 
                    height={300} 
                    color="#8b5cf6" 
                  />
                </CardContent>
              </Card>

              {/* System Analytics Card */}
              <Card className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900">System Analytics</CardTitle>
                      <CardDescription className="text-gray-500">Comprehensive insights</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-6">
                  <div className="grid gap-4">
                    <div className="text-center p-6 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50">
                      <div className="text-3xl font-bold text-emerald-600 mb-1">{stats?.totalSubmissions || 0}</div>
                      <div className="text-sm text-gray-600 font-medium">Total Submissions</div>
                    </div>
                    <div className="text-center p-6 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50">
                      <div className="text-3xl font-bold text-amber-600 mb-1">{stats?.pendingApprovals || 0}</div>
                      <div className="text-sm text-gray-600 font-medium">Pending Approval</div>
                    </div>
                    <div className="text-center p-6 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50">
                      <div className="text-3xl font-bold text-blue-600 mb-1">{stats?.thisMonth || 0}</div>
                      <div className="text-sm text-gray-600 font-medium">This Month</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getQuickActionsFooter = () => {
    switch (user?.role) {
      case 'faculty':
        return (
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">Quick Actions</CardTitle>
                  <CardDescription className="text-gray-500">Manage your submissions efficiently</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <Link to="/submissions/new" className="group">
                  <div className="bg-white rounded-2xl p-6 border border-blue-100 hover:border-blue-200 transition-all duration-200 hover:shadow-md group-hover:-translate-y-1">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">New Submission</h3>
                        <p className="text-sm text-gray-500">Create a new submission</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200" />
                    </div>
                  </div>
                </Link>
                <Link to="/submissions" className="group">
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 transition-all duration-200 hover:shadow-md group-hover:-translate-y-1">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">My Submissions</h3>
                        <p className="text-sm text-gray-500">View your submissions</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all duration-200" />
                    </div>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        );

      case 'hod':
        return (
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">Department Management</CardTitle>
                  <CardDescription className="text-gray-500">Review and manage department submissions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/approvals" className="group block">
                <div className="bg-white rounded-2xl p-6 border border-amber-100 hover:border-amber-200 transition-all duration-200 hover:shadow-md group-hover:-translate-y-1">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Review Submissions</h3>
                      <p className="text-sm text-gray-500">{stats?.pendingApprovals || 0} pending submissions</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all duration-200" />
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        );

      case 'admin':
        return (
          <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-900">System Administration</CardTitle>
                  <CardDescription className="text-gray-500">Manage system-wide operations</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-4 sm:grid-cols-3">
                <Link to="/approvals" className="group">
                  <div className="bg-white rounded-2xl p-4 border border-purple-100 hover:border-purple-200 transition-all duration-200 hover:shadow-md group-hover:-translate-y-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm">Final Approvals</h3>
                        <p className="text-xs text-gray-500 truncate">Review submissions</p>
                      </div>
                    </div>
                  </div>
                </Link>
                <Link to="/users" className="group">
                  <div className="bg-white rounded-2xl p-4 border border-blue-100 hover:border-blue-200 transition-all duration-200 hover:shadow-md group-hover:-translate-y-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm">Manage Users</h3>
                        <p className="text-xs text-gray-500 truncate">User administration</p>
                      </div>
                    </div>
                  </div>
                </Link>
                <Link to="/reports" className="group">
                  <div className="bg-white rounded-2xl p-4 border border-emerald-100 hover:border-emerald-200 transition-all duration-200 hover:shadow-md group-hover:-translate-y-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm">Generate Reports</h3>
                        <p className="text-xs text-gray-500 truncate">Analytics & reports</p>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  if (statsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-6 py-8 space-y-8 animate-fade-in">
        {/* Welcome Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-8 text-white shadow-2xl">
          <div className="relative z-10">
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              Welcome back, {user?.name}
            </h1>
            <p className="text-blue-100 text-lg opacity-90 font-medium">
              {user?.designation} • {user?.department} • {user?.institution}
            </p>
          </div>
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-96 h-96 opacity-10 transform translate-x-24 -translate-y-24">
            <div className="w-full h-full bg-white rounded-full"></div>
          </div>
        </div>

        {/* Enhanced Stats Overview */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <ModernStatsCard
            title="Total Submissions"
            value={stats?.totalSubmissions || 0}
            icon={<FileText className="w-7 h-7" />}
            gradient="from-blue-500 to-blue-600"
            trend={stats?.thisMonth && stats?.lastMonth ? {
              value: Math.round(((stats.thisMonth - stats.lastMonth) / (stats.lastMonth || 1)) * 100),
              isPositive: stats.thisMonth >= stats.lastMonth
            } : undefined}
            delay={0}
          />
          <ModernStatsCard
            title="Pending Approvals"
            value={stats?.pendingApprovals || 0}
            icon={<Clock className="w-7 h-7" />}
            gradient="from-amber-500 to-orange-500"
            delay={100}
          />
          <ModernStatsCard
            title="Approved"
            value={stats?.approved || 0}
            icon={<CheckCircle className="w-7 h-7" />}
            gradient="from-emerald-500 to-green-500"
            delay={200}
          />
          <ModernStatsCard
            title="This Month"
            value={stats?.thisMonth || 0}
            icon={<TrendingUp className="w-7 h-7" />}
            gradient="from-purple-500 to-indigo-500"
            delay={300}
          />
        </div>

        {/* Role-specific content */}
        {getRoleSpecificContent()}

        {/* Quick Actions Footer */}
        {getQuickActionsFooter()}
      </div>
    </div>
  );
};
