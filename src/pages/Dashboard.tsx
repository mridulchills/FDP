
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedStatsCard } from '@/components/charts/AnimatedStatsCard';
import { AnimatedPieChart } from '@/components/charts/AnimatedPieChart';
import { AnimatedBarChart } from '@/components/charts/AnimatedBarChart';
import { DashboardStats, ChartData } from '@/types';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Users,
  Calendar,
  Award
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [moduleData, setModuleData] = useState<ChartData[]>([]);
  const [monthlyData, setMonthlyData] = useState<ChartData[]>([]);
  const [statusData, setStatusData] = useState<ChartData[]>([]);

  useEffect(() => {
    // Mock data - in real app, this would come from API
    const mockStats: DashboardStats = {
      totalSubmissions: 42,
      pendingApprovals: 8,
      approved: 28,
      rejected: 6,
      thisMonth: 12,
      lastMonth: 8
    };

    const mockModuleData: ChartData[] = [
      { name: 'Programs Attended', value: 18, color: '#2C2E83' },
      { name: 'Programs Organized', value: 12, color: '#FFCC00' },
      { name: 'Certifications', value: 12, color: '#4F46E5' }
    ];

    const mockMonthlyData: ChartData[] = [
      { name: 'Jan', value: 8 },
      { name: 'Feb', value: 12 },
      { name: 'Mar', value: 6 },
      { name: 'Apr', value: 15 },
      { name: 'May', value: 10 },
      { name: 'Jun', value: 14 }
    ];

    const mockStatusData: ChartData[] = [
      { name: 'Approved', value: 28, color: '#10B981' },
      { name: 'Pending', value: 8, color: '#F59E0B' },
      { name: 'Rejected', value: 6, color: '#EF4444' }
    ];

    // Simulate loading delay
    setTimeout(() => {
      setStats(mockStats);
      setModuleData(mockModuleData);
      setMonthlyData(mockMonthlyData);
      setStatusData(mockStatusData);
    }, 500);
  }, []);

  const getRoleSpecificTitle = () => {
    switch (user?.role) {
      case 'faculty':
        return 'Faculty Dashboard';
      case 'hod':
        return 'HoD Dashboard';
      case 'admin':
        return 'Admin Dashboard';
      default:
        return 'Dashboard';
    }
  };

  const getRoleSpecificStats = () => {
    if (!stats) return [];

    const baseStats = [
      {
        title: 'Total Submissions',
        value: stats.totalSubmissions,
        icon: <FileText size={24} />,
        color: 'bg-blue-100 text-blue-600',
        trend: { value: 15, isPositive: true }
      },
      {
        title: user?.role === 'faculty' ? 'Pending Reviews' : 'Pending Approvals',
        value: stats.pendingApprovals,
        icon: <Clock size={24} />,
        color: 'bg-yellow-100 text-yellow-600',
        trend: { value: 5, isPositive: false }
      },
      {
        title: 'Approved',
        value: stats.approved,
        icon: <CheckCircle size={24} />,
        color: 'bg-green-100 text-green-600',
        trend: { value: 20, isPositive: true }
      },
      {
        title: 'Rejected',
        value: stats.rejected,
        icon: <XCircle size={24} />,
        color: 'bg-red-100 text-red-600'
      }
    ];

    if (user?.role === 'admin') {
      baseStats.push({
        title: 'Total Users',
        value: 156,
        icon: <Users size={24} />,
        color: 'bg-purple-100 text-purple-600',
        trend: { value: 8, isPositive: true }
      });
    }

    return baseStats;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 animate-fade-in">
            {getRoleSpecificTitle()}
          </h1>
          <p className="text-gray-600 mt-1 animate-slide-in">
            Welcome back, {user?.name}! Here's your activity overview.
          </p>
        </div>
        <div className="bg-gradient-nmit text-white px-4 py-2 rounded-lg animate-pulse-glow">
          <div className="flex items-center space-x-2">
            <TrendingUp size={20} />
            <span className="font-medium">
              {stats ? `+${((stats.thisMonth - stats.lastMonth) / stats.lastMonth * 100).toFixed(0)}%` : '...'}
            </span>
          </div>
          <p className="text-xs opacity-90">vs last month</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="dashboard-grid">
        {getRoleSpecificStats().map((stat, index) => (
          <AnimatedStatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            trend={stat.trend}
            delay={index * 100}
          />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <AnimatedPieChart
          data={statusData}
          title="Submission Status Distribution"
          height={300}
        />

        {/* Module Distribution */}
        <AnimatedPieChart
          data={moduleData}
          title="Submissions by Module"
          height={300}
        />
      </div>

      {/* Monthly Trend */}
      <AnimatedBarChart
        data={monthlyData}
        title="Monthly Submission Trends"
        height={350}
        color="#2C2E83"
      />

      {/* Quick Actions */}
      <div className="nmit-card animate-fade-in">
        <div className="nmit-card-header">
          <h3 className="nmit-card-title">Quick Actions</h3>
        </div>
        <div className="nmit-card-content">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {user?.role === 'faculty' && (
              <>
                <button className="p-4 bg-gradient-to-r from-nmit-blue to-blue-700 text-white rounded-lg hover:shadow-lg transition-all duration-200 group">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all">
                      <FileText size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">New Submission</p>
                      <p className="text-xs opacity-90">Submit new program</p>
                    </div>
                  </div>
                </button>
                <button className="p-4 bg-gradient-to-r from-nmit-yellow to-yellow-500 text-gray-800 rounded-lg hover:shadow-lg transition-all duration-200 group">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white bg-opacity-50 rounded-full group-hover:bg-opacity-70 transition-all">
                      <Award size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Upload Certificate</p>
                      <p className="text-xs opacity-75">Add certification</p>
                    </div>
                  </div>
                </button>
              </>
            )}
            {(user?.role === 'hod' || user?.role === 'admin') && (
              <button className="p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all">
                    <Clock size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Review Pending</p>
                    <p className="text-xs opacity-90">{stats?.pendingApprovals} items waiting</p>
                  </div>
                </div>
              </button>
            )}
            <button className="p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 group">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white bg-opacity-20 rounded-full group-hover:bg-opacity-30 transition-all">
                  <Calendar size={20} />
                </div>
                <div className="text-left">
                  <p className="font-medium">View Reports</p>
                  <p className="text-xs opacity-90">Generate insights</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
