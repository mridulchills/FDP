
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

export const Login: React.FC = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employeeId.trim() || !password.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const success = await login({ employeeId: employeeId.trim(), password });
      if (success) {
        navigate('/dashboard');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" text="Authenticating..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-nmit-blue via-blue-800 to-blue-900 p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="bg-white p-4 rounded-full w-20 h-20 mx-auto mb-4 shadow-lg">
            <div className="w-full h-full bg-gradient-nmit rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl">N</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">FDTS Portal</h1>
          <p className="text-blue-100">Faculty Development Tracking System</p>
          <p className="text-blue-200 text-sm">Nitte Meenakshi Institute of Technology</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl border-0">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center text-gray-900">
              Sign In
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Employee ID Field */}
              <div className="space-y-2">
                <Label htmlFor="employeeId" className="text-sm font-medium">
                  Employee ID
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="employeeId"
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="Enter your employee ID"
                    className="pl-10 h-12"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 pr-10 h-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !employeeId.trim() || !password.trim()}
                className="w-full h-12 bg-nmit-blue hover:bg-blue-800 text-white font-medium transition-all duration-200 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <LoadingSpinner size="sm" text="" />
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Demo Credentials:</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <div>Faculty: <code className="bg-white px-1 rounded">FAC001</code> / <code className="bg-white px-1 rounded">password123</code></div>
                <div>HoD: <code className="bg-white px-1 rounded">HOD001</code> / <code className="bg-white px-1 rounded">password123</code></div>
                <div>Admin: <code className="bg-white px-1 rounded">ADM001</code> / <code className="bg-white px-1 rounded">password123</code></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-blue-200 text-sm">
          <p>© 2024 NMIT. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};
