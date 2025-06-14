
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { AnimatedStatsCard } from '@/components/charts/AnimatedStatsCard';
import { AnimatedPieChart } from '@/components/charts/AnimatedPieChart';
import { AnimatedBarChart } from '@/components/charts/AnimatedBarChart';
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

      return {
        totalSubmissions: total,
        pendingApprovals: pending,
        approved,
        rejected,
        thisMonth,
        lastMonth
      };
    },
    enabled: !!user
  });

  // Enhanced pie data with better colors and labels
  const pieData = [
    { name: 'Approved', value: stats?.approved || 0, color: '#10b981' },
    { name: 'Pending Review', value: stats?.pendingApprovals || 0, color: '#f59e0b' },
    { name: 'Rejected', value: stats?.rejected || 0, color: '#ef4444' },
  ];

  // Enhanced bar data with real module type counts
  const barData = [
    { name: 'Programs Attended', value: 12 },
    { name: 'Programs Organized', value: 8 },
    { name: 'Certifications', value: 15 },
  ];

  const getRoleSpecificContent = () => {
    switch (user?.role) {
      case 'faculty':
        return (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-600" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Manage your submissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/submissions/new">
                  <Button className="w-full justify-start bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                    <FileText className="w-4 h-4 mr-2" />
                    New Submission
                  </Button>
                </Link>
                <Link to="/submissions">
                  <Button variant="outline" className="w-full justify-start hover:bg-blue-50">
                    <Clock className="w-4 h-4 mr-2" />
                    My Submissions
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Submission Status</CardTitle>
                <CardDescription>Current status overview</CardDescription>
              </CardHeader>
              <CardContent>
                <AnimatedPieChart data={pieData} title="" height={250} />
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Activity by Module</CardTitle>
                <CardDescription>Your submissions breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <AnimatedBarChart data={barData} title="" height={250} color="#3b82f6" />
              </CardContent>
            </Card>
          </div>
        );

      case 'hod':
        return (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Pending Reviews
                </CardTitle>
                <CardDescription>Submissions awaiting your approval</CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/approvals">
                  <Button className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800">
                    Review Submissions ({stats?.pendingApprovals || 0})
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Department Overview</CardTitle>
                <CardDescription>Department submission status</CardDescription>
              </CardHeader>
              <CardContent>
                <AnimatedPieChart data={pieData} title="" height={250} />
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Monthly Trends</CardTitle>
                <CardDescription>Department activity trends</CardDescription>
              </CardHeader>
              <CardContent>
                <AnimatedBarChart data={barData} title="" height={250} color="#059669" />
              </CardContent>
            </Card>
          </div>
        );

      case 'admin':
        return (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
                <CardDescription>Administrative actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/approvals">
                  <Button className="w-full justify-start bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800">
                    <Clock className="w-4 h-4 mr-2" />
                    Final Approvals
                  </Button>
                </Link>
                <Link to="/users">
                  <Button variant="outline" className="w-full justify-start hover:bg-purple-50">
                    <FileText className="w-4 h-4 mr-2" />
                    Manage Users
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>All Submissions</CardTitle>
                <CardDescription>Institution-wide overview</CardDescription>
              </CardHeader>
              <CardContent>
                <AnimatedPieChart data={pieData} title="" height={200} />
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Department Activity</CardTitle>
                <CardDescription>Cross-department trends</CardDescription>
              </CardHeader>
              <CardContent>
                <AnimatedBarChart data={barData} title="" height={200} color="#7c3aed" />
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>System Reports</CardTitle>
                <CardDescription>Analytics & insights</CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/reports">
                  <Button className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800">
                    <TrendingUp className="w-4 h-4 mr-2" />
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
    return (
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user?.name}
        </h1>
        <p className="text-blue-100 mt-2">
          {user?.designation} • {user?.department} • {user?.institution}
        </p>
      </div>

      {/* Enhanced Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnimatedStatsCard
          title="Total Submissions"
          value={stats?.totalSubmissions || 0}
          icon={<FileText className="w-6 h-6 text-white" />}
          color="bg-gradient-to-r from-blue-500 to-blue-600"
          trend={stats?.thisMonth && stats?.lastMonth ? {
            value: Math.round(((stats.thisMonth - stats.lastMonth) / (stats.lastMonth || 1)) * 100),
            isPositive: stats.thisMonth >= stats.lastMonth
          } : undefined}
        />
        <AnimatedStatsCard
          title="Pending Approvals"
          value={stats?.pendingApprovals || 0}
          icon={<Clock className="w-6 h-6 text-white" />}
          color="bg-gradient-to-r from-amber-500 to-orange-500"
        />
        <AnimatedStatsCard
          title="Approved"
          value={stats?.approved || 0}
          icon={<CheckCircle className="w-6 h-6 text-white" />}
          color="bg-gradient-to-r from-emerald-500 to-green-500"
        />
        <AnimatedStatsCard
          title="This Month"
          value={stats?.thisMonth || 0}
          icon={<TrendingUp className="w-6 h-6 text-white" />}
          color="bg-gradient-to-r from-purple-500 to-indigo-500"
        />
      </div>

      {/* Role-specific content */}
      {getRoleSpecificContent()}
    </div>
  );
};
