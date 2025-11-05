
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { Button } from '@/components/ui/button';
import { User, Menu } from 'lucide-react';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { toggleSidebar } = useSidebar();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Mobile Menu Button and Logo */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="lg:hidden p-2"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </Button>
          
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-2 rounded-lg">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">N</span>
            </div>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-bold text-gray-900">
              Faculty Development Tracking System
            </h1>
            <p className="text-sm text-gray-600">
              Nitte Meenakshi Institute of Technology
            </p>
          </div>
          <div className="sm:hidden">
            <h1 className="text-lg font-bold text-gray-900">FDTS</h1>
          </div>
        </div>

        {/* User Menu */}
        <div className="flex items-center space-x-4">
          {/* Desktop Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="hidden lg:block p-2"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </Button>
          
          {/* Notifications */}
          <NotificationDropdown />

          {/* User Profile */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-600 capitalize">
                {user?.role} • {user?.department}
              </p>
            </div>
            <div className="bg-blue-600 text-white p-2 rounded-full">
              <User size={16} />
            </div>
          </div>

          {/* Logout Button */}
          <Button 
            onClick={logout}
            variant="outline"
            size="sm"
            className="border-blue-600 text-blue-600 hover:bg-blue-50 hidden sm:flex"
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};
