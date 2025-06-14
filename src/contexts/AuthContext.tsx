
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, AuthResponse } from '@/types';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demonstration
const MOCK_USERS: User[] = [
  {
    id: '1',
    employeeId: 'FAC001',
    name: 'Dr. Priya Sharma',
    email: 'priya.sharma@nmit.ac.in',
    role: 'faculty',
    department: 'Computer Science',
    designation: 'Assistant Professor',
    institution: 'NMIT',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    employeeId: 'HOD001',
    name: 'Dr. Rajesh Kumar',
    email: 'rajesh.kumar@nmit.ac.in',
    role: 'hod',
    department: 'Computer Science',
    designation: 'Professor & Head',
    institution: 'NMIT',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    employeeId: 'ADM001',
    name: 'Dr. Sanjay Patel',
    email: 'sanjay.patel@nmit.ac.in',
    role: 'admin',
    department: 'Administration',
    designation: 'Dean Academic',
    institution: 'NMIT',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth token
    const token = localStorage.getItem('fdts_token');
    const userData = localStorage.getItem('fdts_user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('fdts_token');
        localStorage.removeItem('fdts_user');
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Mock authentication - in real app, this would be an API call
      const mockUser = MOCK_USERS.find(u => u.employeeId === credentials.employeeId);
      
      if (!mockUser) {
        toast({
          title: "Login Failed",
          description: "Invalid employee ID or password",
          variant: "destructive"
        });
        return false;
      }

      // Mock password validation (in real app, password would be hashed)
      if (credentials.password !== 'password123') {
        toast({
          title: "Login Failed", 
          description: "Invalid employee ID or password",
          variant: "destructive"
        });
        return false;
      }

      // Store auth data
      const mockToken = `mock_token_${Date.now()}`;
      localStorage.setItem('fdts_token', mockToken);
      localStorage.setItem('fdts_user', JSON.stringify(mockUser));
      
      setUser(mockUser);
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${mockUser.name}!`
      });
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Login Error",
        description: "An error occurred during login. Please try again.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('fdts_token');
    localStorage.removeItem('fdts_user');
    setUser(null);
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out."
    });
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('fdts_user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
