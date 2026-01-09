import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Courses from "./pages/Courses";
import CoursePlayer from "./pages/CoursePlayer";
import ProgressDashboard from "./pages/ProgressDashboard";
import AdminPanel from "./pages/AdminPanel";
import AdminDashboard from "./pages/AdminDashboard";
import CourseManagement from "./pages/CourseManagement";
import LearnerManagement from "./pages/LearnerManagement";
import ProtectedRoute from "./components/ProtectedRoute";
import { MainLayout } from "./components/layout/MainLayout";
import { isAuthenticated } from "./services/auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={isAuthenticated() ? <Navigate to="/courses" replace /> : <Login />}
            />
            <Route
              path="/register"
              element={isAuthenticated() ? <Navigate to="/courses" replace /> : <Register />}
            />
            <Route
              path="/courses"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Courses />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/player/:courseId"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CoursePlayer />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ProgressDashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <Navigate to="/admin/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <AdminDashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <CourseManagement />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/learners"
              element={
                <ProtectedRoute requireAdmin>
                  <MainLayout>
                    <LearnerManagement />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/courses" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
