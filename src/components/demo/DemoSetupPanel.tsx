
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Copy, Users } from 'lucide-react';
import { createDemoAuthUsers, getDemoCredentialsInfo, DEMO_USERS } from '@/utils/demoSetup';
import { toast } from '@/hooks/use-toast';

export const DemoSetupPanel: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [setupResults, setSetupResults] = useState<any[]>([]);
  const [showCredentials, setShowCredentials] = useState(false);

  const handleCreateDemoUsers = async () => {
    setIsCreating(true);
    try {
      const results = await createDemoAuthUsers();
      setSetupResults(results);
      setShowCredentials(true);
      
      const successCount = results.filter(r => r.success).length;
      toast({
        title: "Demo Setup Complete",
        description: `${successCount}/${results.length} demo users created successfully`,
      });
    } catch (error) {
      toast({
        title: "Setup Error",
        description: "Failed to create demo users. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Credentials copied to clipboard",
    });
  };

  const credentials = getDemoCredentialsInfo();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Demo Setup
          </CardTitle>
          <CardDescription>
            Set up demo accounts for testing the Faculty Development Portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showCredentials ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Demo Users to be Created:</h4>
                <div className="grid gap-2">
                  {DEMO_USERS.map((user) => (
                    <div key={user.employeeId} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{user.name}</span>
                        <Badge variant="outline" className="ml-2">{user.role}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <Button 
                onClick={handleCreateDemoUsers} 
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? 'Creating Demo Users...' : 'Create Demo Authentication Accounts'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="font-medium text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Demo Setup Complete!
              </h4>
              
              {setupResults.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium">Setup Results:</h5>
                  {setupResults.map((result, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span>{result.employeeId}: {result.success ? 'Success' : result.error}</span>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Demo Login Credentials</h4>
                
                <div className="space-y-3">
                  <div>
                    <h5 className="font-medium text-blue-600 mb-2">Faculty Accounts</h5>
                    {credentials.faculty.map((cred, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded border">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{cred.name}</div>
                            <div className="text-sm text-gray-600">Email: {cred.email}</div>
                            <div className="text-sm text-gray-600">Password: {cred.password}</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(`${cred.email}\n${cred.password}`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h5 className="font-medium text-purple-600 mb-2">HoD Accounts</h5>
                    {credentials.hod.map((cred, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded border">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{cred.name}</div>
                            <div className="text-sm text-gray-600">Email: {cred.email}</div>
                            <div className="text-sm text-gray-600">Password: {cred.password}</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(`${cred.email}\n${cred.password}`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h5 className="font-medium text-red-600 mb-2">Faculty Development Cell</h5>
                    {credentials.admin.map((cred, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded border">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{cred.name}</div>
                            <div className="text-sm text-gray-600">Email: {cred.email}</div>
                            <div className="text-sm text-gray-600">Password: {cred.password}</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(`${cred.email}\n${cred.password}`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {credentials.accounts && (
                    <div>
                      <h5 className="font-medium text-orange-600 mb-2">Accounts Department</h5>
                      {credentials.accounts.map((cred, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded border">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{cred.name}</div>
                              <div className="text-sm text-gray-600">Email: {cred.email}</div>
                              <div className="text-sm text-gray-600">Password: {cred.password}</div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(`${cred.email}\n${cred.password}`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded border border-blue-200">
                  <h5 className="font-medium text-blue-800 mb-2">Testing Workflow:</h5>
                  <ol className="text-sm text-blue-700 space-y-1">
                    <li>1. Login as Faculty (FAC001) to create new submissions</li>
                    <li>2. Login as HoD (HOD001) to approve/reject faculty submissions</li>
                    <li>3. Login as Faculty Development Cell (ADM001) for admin approval</li>
                    <li>4. Login as HoD (HOD001) for HoD approval</li>
                    <li>5. Login as Accounts (ACC001) for final approval</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
