
import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NotificationProvider } from '@/contexts/NotificationContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <NotificationProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
};
