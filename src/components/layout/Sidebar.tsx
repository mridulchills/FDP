
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  FileText, 
  Clock, 
  CheckCircle, 
  Settings,
  Plus,
  Calendar,
  Users
} from 'lucide-react';

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
    roles: ['faculty', 'hod', 'admin']
  }
];

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const filteredItems = sidebarItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <aside className="bg-white w-64 min-h-screen shadow-lg border-r border-gray-200">
      <div className="p-6">
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
  );
};
