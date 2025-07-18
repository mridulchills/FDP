
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { 
  User, 
  FileText, 
  Clock, 
  CheckCircle, 
  Settings,
  Plus,
  Calendar,
  Users,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: ('faculty' | 'hod' | 'admin')[];
}

const sidebarItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    icon: <User size={20} />,
    path: '/dashboard',
    roles: ['faculty', 'hod', 'admin']
  },
  {
    label: 'New Submission',
    icon: <Plus size={20} />,
    path: '/submissions/new',
    roles: ['faculty']
  },
  {
    label: 'My Submissions',
    icon: <FileText size={20} />,
    path: '/submissions',
    roles: ['faculty']
  },
  {
    label: 'Pending Approvals',
    icon: <Clock size={20} />,
    path: '/approvals',
    roles: ['hod', 'admin']
  },
  {
    label: 'All Submissions',
    icon: <CheckCircle size={20} />,
    path: '/all-submissions',
    roles: ['hod', 'admin']
  },
  {
    label: 'User Management',
    icon: <Users size={20} />,
    path: '/users',
    roles: ['admin']
  },
  {
    label: 'Reports',
    icon: <Calendar size={20} />,
    path: '/reports',
    roles: ['hod', 'admin']
  },
  {
    label: 'Settings',
    icon: <Settings size={20} />,
    path: '/settings',
    roles: [ 'hod', 'admin']
  }
];

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const { isOpen, setIsOpen, isMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();

  const filteredItems = sidebarItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  const handleNavigation = (path: string) => {
    navigate(path);
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const handleBackdropClick = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={handleBackdropClick}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${isMobile 
          ? 'fixed left-0 top-0 z-50 h-full w-64 transform transition-transform duration-300' 
          : 'w-64 transition-all duration-300'
        }
        bg-white shadow-lg border-r border-gray-200
      `}>
        <div className="p-6">
          {/* Mobile Close Button */}
          {isMobile && (
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="p-2"
              >
                <X size={20} />
              </Button>
            </div>
          )}

          <nav className="space-y-2">
            {filteredItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
};
