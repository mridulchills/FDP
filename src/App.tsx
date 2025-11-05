import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/layout/Layout";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { NewSubmission } from "@/pages/NewSubmission";
import { MySubmissions } from "@/pages/MySubmissions";
import { ApprovalsDashboard } from "@/pages/ApprovalsDashboard";
import { AllSubmissions } from "@/pages/AllSubmissions";
import { UserManagement } from "@/pages/UserManagement";
import { Reports } from "@/pages/Reports";
import { Settings } from "@/pages/Settings";
import { UserProfile } from "@/pages/UserProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      
      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Faculty Only Routes */}
      <Route
        path="/submissions/new"
        element={
          <ProtectedRoute allowedRoles={['faculty']}>
            <Layout>
              <NewSubmission />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/submissions"
        element={
          <ProtectedRoute allowedRoles={['faculty']}>
            <Layout>
              <MySubmissions />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* HoD, Admin, and Accounts Routes */}
      <Route
        path="/approvals"
        element={
          <ProtectedRoute allowedRoles={['hod', 'admin', 'accounts']}>
            <Layout>
              <ApprovalsDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/all-submissions"
        element={
          <ProtectedRoute allowedRoles={['hod', 'admin', 'accounts']}>
            <Layout>
              <AllSubmissions />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin Only Routes */}
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <UserManagement />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Common Routes */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['hod', 'admin']}>
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <UserProfile />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
