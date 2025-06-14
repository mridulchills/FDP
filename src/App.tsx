
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
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

      {/* HoD and Admin Routes */}
      <Route
        path="/approvals"
        element={
          <ProtectedRoute allowedRoles={['hod', 'admin']}>
            <Layout>
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Pending Approvals</h2>
                <p className="text-gray-600">Review and approve pending submissions...</p>
              </div>
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/all-submissions"
        element={
          <ProtectedRoute allowedRoles={['hod', 'admin']}>
            <Layout>
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">All Submissions</h2>
                <p className="text-gray-600">View all submissions in your scope...</p>
              </div>
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
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">User Management</h2>
                <p className="text-gray-600">Manage faculty and HoD accounts...</p>
              </div>
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
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Reports</h2>
                <p className="text-gray-600">Generate and export reports...</p>
              </div>
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
                <p className="text-gray-600">Manage your profile and preferences...</p>
              </div>
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

const App = () => (
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

export default App;
