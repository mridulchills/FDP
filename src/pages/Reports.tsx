
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
import { Download, Calendar, TrendingUp, Users, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState('month');
  const [department, setDepartment] = useState('all');

  const { data: submissions = [] } = useQuery({
    queryKey: ['reports-submissions'],
    queryFn: () => submissionService.getAllSubmissions(),
    select: (response) => response.data || [],
  });

  // Calculate statistics
  const totalSubmissions = submissions.length;
  const approvedSubmissions = submissions.filter(s => s.status === 'Approved by Admin').length;
  const pendingSubmissions = submissions.filter(s => s.status.includes('Pending')).length;
  const rejectedSubmissions = submissions.filter(s => s.status.includes('Rejected')).length;

  const moduleData = [
    { name: 'Programs Attended', value: submissions.filter(s => s.moduleType === 'attended').length },
    { name: 'Programs Organized', value: submissions.filter(s => s.moduleType === 'organized').length },
    { name: 'Certifications', value: submissions.filter(s => s.moduleType === 'certification').length }
  ];

  const statusData = [
    { name: 'Approved', value: approvedSubmissions, color: '#00C49F' },
    { name: 'Pending', value: pendingSubmissions, color: '#FFBB28' },
    { name: 'Rejected', value: rejectedSubmissions, color: '#FF4C4C' }
  ];

  const monthlyData = [
    { name: 'Jan', value: 12 },
    { name: 'Feb', value: 15 },
    { name: 'Mar', value: 18 },
    { name: 'Apr', value: 22 },
    { name: 'May', value: 25 },
    { name: 'Jun', value: 28 }
  ];

  const handleExport = () => {
    console.log('Exporting report data...');
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">View comprehensive reports and analytics</p>
        </div>
        <Button onClick={handleExport} className="flex items-center gap-2">
          <Download size={16} />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="cse">Computer Science</SelectItem>
                <SelectItem value="ise">Information Science</SelectItem>
                <SelectItem value="ece">Electronics & Communication</SelectItem>
                <SelectItem value="me">Mechanical Engineering</SelectItem>
                <SelectItem value="ce">Civil Engineering</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar size={14} />
                {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

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
          value={45}
          trend={{ value: 15, isPositive: true }}
          icon={<Users />}
          gradient="from-purple-500 to-purple-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModernBarChart
          data={monthlyData}
        />
        
        <ModernPieChart
          data={statusData}
          total={totalSubmissions}
        />
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
    </div>
  );
};
