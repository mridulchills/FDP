
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Welcome Header Skeleton */}
      <div className="bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl p-8 animate-pulse">
        <div className="h-8 bg-gray-300 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-md animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role-specific Content Skeleton */}
      <div className="grid gap-8 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="shadow-md animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
