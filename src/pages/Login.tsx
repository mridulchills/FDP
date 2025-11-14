
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';
import nmitLogoHorizontal from '@/assets/nmit-logo-horizontal.png';
import nmitCampus from '@/assets/nmit-campus.jpeg';

export const Login: React.FC = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login({ employeeId, password });
      if (success) {
        navigate(from, { replace: true });
      } else {
        setError('Invalid credentials. Please check your employee ID and password.');
      }
    } catch (error) {
      setError('An error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = (email: string, pass: string) => {
    setEmployeeId(email);
    setPassword(pass);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.65)), url(${nmitCampus})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="w-full max-w-4xl">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 mb-4">
            <img 
              src={nmitLogoHorizontal} 
              alt="NMIT Logo" 
              className="h-20 sm:h-24 md:h-28 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Faculty Development Portal</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Nitte Meenakshi Institute of Technology</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your employee credentials to access the portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID / Email</Label>
                <Input
                  id="employeeId"
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g., FAC001 or FAC001@nmit.ac.in"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded border border-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <Separator className="my-6" />

            <div className="space-y-4">
              <h4 className="font-medium text-center">Quick Demo Login</h4>
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  onClick={() => fillDemoCredentials('FAC001@nmit.ac.in', 'demo123')}
                  className="text-blue-600"
                >
                  Faculty Demo (Dr. John Smith)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fillDemoCredentials('HOD001@nmit.ac.in', 'demo123')}
                  className="text-purple-600"
                >
                  HoD Demo (Dr. Sarah Johnson)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fillDemoCredentials('ADM001@nmit.ac.in', 'demo123')}
                  className="text-red-600"
                >
                  Faculty Development Cell Demo (Dr. Michael Brown)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
