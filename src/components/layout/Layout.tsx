
import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

interface LayoutProps {
  children: React.ReactNode;
}

const LayoutContent: React.FC<LayoutProps> = ({ children }) => {
  const { isOpen, isMobile } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex flex-1 relative">
        <Sidebar />
        <main className={`
          flex-1 p-4 sm:p-6 transition-all duration-300
          ${!isMobile && isOpen ? 'lg:ml-0' : ''}
          ${isMobile ? 'w-full' : ''}
        `}>
          {children}
        </main>
      </div>
    </div>
  );
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <NotificationProvider>
      <SidebarProvider>
        <LayoutContent>{children}</LayoutContent>
      </SidebarProvider>
    </NotificationProvider>
  );
};
