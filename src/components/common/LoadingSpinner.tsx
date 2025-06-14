
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text = 'Loading...' 
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className={`${sizeClasses[size]} border-4 border-gray-200 border-t-nmit-blue rounded-full animate-spin`} />
      {text && <p className="text-sm text-gray-600 animate-pulse">{text}</p>}
    </div>
  );
};

export const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <LoadingSpinner size="lg" text="Loading FDTS..." />
  </div>
);

export const SkeletonCard: React.FC = () => (
  <div className="nmit-card animate-pulse">
    <div className="nmit-card-header">
      <div className="h-6 bg-blue-200 rounded w-3/4"></div>
    </div>
    <div className="nmit-card-content space-y-3">
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  </div>
);
