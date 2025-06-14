
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { User, Bell } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center space-x-4">
          <div className="bg-gradient-nmit p-2 rounded-lg">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
              <span className="text-nmit-blue font-bold text-sm">N</span>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Faculty Development Tracking System
            </h1>
            <p className="text-sm text-gray-600">
              Nitte Meenakshi Institute of Technology
            </p>
          </div>
        </div>

        {/* User Menu */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              3
            </span>
          </Button>

          {/* User Profile */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-600 capitalize">
                {user?.role} • {user?.department}
              </p>
            </div>
            <div className="bg-nmit-blue text-white p-2 rounded-full">
              <User size={16} />
            </div>
          </div>

          {/* Logout Button */}
          <Button 
            onClick={logout}
            variant="outline"
            size="sm"
            className="nmit-btn-outline"
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};
