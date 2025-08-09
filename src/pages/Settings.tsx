
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Settings as SettingsIcon, Clock, Wrench } from 'lucide-react';

export const Settings: React.FC = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon size={32} className="text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">System configuration and preferences</p>
        </div>
      </div>

      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                <Wrench size={40} className="text-primary" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock size={16} className="text-orange-600" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Coming Soon</h2>
              <p className="text-muted-foreground max-w-sm">
                We're working hard to bring you advanced settings and configuration options. 
                Stay tuned for exciting updates!
              </p>
            </div>
            
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: '75%' }}></div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Development in progress...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
