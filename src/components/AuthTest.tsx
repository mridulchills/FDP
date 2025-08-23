import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const AuthTest: React.FC = () => {
  const { user, isLoading, login, logout } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const handleLogin = async () => {
    setTestLoading(true);
    try {
      const success = await login({ employeeId, password });
      console.log('Login result:', success);
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setTestLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      console.log('Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return <div>Loading auth state...</div>;
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Authentication Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {user ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Logged in as:</h3>
              <p>Name: {user.name}</p>
              <p>Employee ID: {user.employeeId}</p>
              <p>Role: {user.role}</p>
              <p>Email: {user.email}</p>
            </div>
            <Button onClick={handleLogout} variant="outline">
              Logout
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="employeeId" className="block text-sm font-medium mb-1">
                Employee ID
              </label>
              <Input
                id="employeeId"
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="Enter employee ID"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <Button 
              onClick={handleLogin} 
              disabled={testLoading || !employeeId || !password}
              className="w-full"
            >
              {testLoading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};