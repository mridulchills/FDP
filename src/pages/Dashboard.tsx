
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

  // Mock data for charts (will be replaced with real data later)
  const pieData = [
    { name: 'Approved', value: stats?.approved || 0, color: '#22c55e' },
    { name: 'Pending', value: stats?.pendingApprovals || 0, color: '#eab308' },
    { name: 'Rejected', value: stats?.rejected || 0, color: '#ef4444' },
  ];

  const barData = [
    { name: 'Programs Attended', value: 5 },
    { name: 'Programs Organized', value: 3 },
    { name: 'Certifications', value: 8 },
  ];

  const getRoleSpecificContent = () => {
    switch (user?.role) {
      case 'faculty':
        return (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/submissions/new">
                  <Button className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    New Submission
                  </Button>
                </Link>
                <Link to="/submissions">
                  <Button variant="outline" className="w-full justify-start">
                    <Clock className="w-4 h-4 mr-2" />
                    My Submissions
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Submission Status</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatedPieChart data={pieData} title="Submission Status" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Module Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatedBarChart data={barData} title="Module Breakdown" />
              </CardContent>
            </Card>
          </div>
        );

      case 'hod':
        return (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Pending Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link to="/approvals">
                  <Button className="w-full">
                    Review Submissions ({stats?.pendingApprovals || 0})
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Department Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatedPieChart data={pieData} title="Department Overview" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatedBarChart data={barData} title="Monthly Trends" />
              </CardContent>
            </Card>
          </div>
        );

      case 'admin':
        return (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to="/approvals">
                  <Button className="w-full justify-start">
                    <Clock className="w-4 h-4 mr-2" />
                    Final Approvals
                  </Button>
                </Link>
                <Link to="/users">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Manage Users
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Submissions</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatedPieChart data={pieData} title="All Submissions" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Department Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatedBarChart data={barData} title="Department Activity" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <Link to="/reports">
                  <Button className="w-full">
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
            <Card key={i}>
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user?.name}
        </h1>
        <p className="text-muted-foreground">
          {user?.designation} • {user?.department} • {user?.institution}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnimatedStatsCard
          title="Total Submissions"
          value={stats?.totalSubmissions || 0}
          icon={<FileText className="w-6 h-6 text-white" />}
          color="bg-blue-500"
          trend={stats?.thisMonth && stats?.lastMonth ? {
            value: Math.round(((stats.thisMonth - stats.lastMonth) / (stats.lastMonth || 1)) * 100),
            isPositive: stats.thisMonth >= stats.lastMonth
          } : undefined}
        />
        <AnimatedStatsCard
          title="Pending Approvals"
          value={stats?.pendingApprovals || 0}
          icon={<Clock className="w-6 h-6 text-white" />}
          color="bg-yellow-500"
        />
        <AnimatedStatsCard
          title="Approved"
          value={stats?.approved || 0}
          icon={<CheckCircle className="w-6 h-6 text-white" />}
          color="bg-green-500"
        />
        <AnimatedStatsCard
          title="This Month"
          value={stats?.thisMonth || 0}
          icon={<TrendingUp className="w-6 h-6 text-white" />}
          color="bg-purple-500"
        />
      </div>

      {/* Role-specific content */}
      {getRoleSpecificContent()}
    </div>
  );
};
