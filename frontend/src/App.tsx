import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Courses from "./pages/Courses";
import CoursePlayer from "./pages/CoursePlayer";
import ProgressDashboard from "./pages/ProgressDashboard";
import AdminPanel from "./pages/AdminPanel";
import AdminDashboard from "./pages/AdminDashboard";
import AdminReports from "./pages/AdminReports";
import ActivityReport from "./pages/ActivityReport";
import CourseManagement from "./pages/CourseManagement";
import LearnerManagement from "./pages/LearnerManagement";
import UserManagement from "./pages/UserManagement";
import ProviderManagement from "./pages/ProviderManagement";
import RolePlaceholder from "./pages/RolePlaceholder";
import ProtectedRoute from "./components/ProtectedRoute";
import { MainLayout } from "./components/layout/MainLayout";
import { isAuthenticated, getDefaultLandingPath } from "./services/auth";
import NotFound from "./pages/NotFound";
import { CurrentCourseProvider } from "./contexts/CurrentCourseContext";

const queryClient = new QueryClient();

const LegacyPlayerRedirect = () => {
  const { courseId } = useParams();
  if (!courseId) {
    return <Navigate to="/learner/courses" replace />;
  }

  return <Navigate to={`/learner/player/${courseId}`} replace />;
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CurrentCourseProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={isAuthenticated() ? <Navigate to={getDefaultLandingPath()} replace /> : <Login />}
            />
            <Route
              path="/register"
              element={isAuthenticated() ? <Navigate to={getDefaultLandingPath()} replace /> : <Register />}
            />
            <Route
              path="/learner"
              element={
                <ProtectedRoute>
                  <Navigate to="/learner/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learner/courses"
              element={
                <ProtectedRoute>
                  <MainLayout navMode="learner">
                    <Courses />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/learner/player/:courseId"
              element={
                <ProtectedRoute>
                  <MainLayout navMode="learner">
                    <CoursePlayer />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/learner/dashboard"
              element={
                <ProtectedRoute>
                  <MainLayout navMode="learner">
                    <ProgressDashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireRole="admin">
                  <Navigate to="/admin/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <AdminDashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <CourseManagement />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/learners"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <LearnerManagement />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/verbs"
              element={
                <ProtectedRoute requireRole="admin">
                  <Navigate to="/admin/xapi/verbs" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/xapi"
              element={
                <ProtectedRoute requireRole="admin">
                  <Navigate to="/admin/xapi/verbs" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/xapi/verbs"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <AdminPanel initialTab="statistics" visibleTabs={['statistics']} />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/xapi/module-rules"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <AdminPanel initialTab="module-rules" visibleTabs={['module-rules']} />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/xapi/inspector"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <AdminPanel initialTab="inspector" visibleTabs={['inspector']} />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/xapi/kc-attempts"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <AdminPanel initialTab="kc-attempts" visibleTabs={['kc-attempts']} />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/xapi/kc-scores"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <AdminPanel initialTab="kc-scores" visibleTabs={['kc-scores']} />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <UserManagement />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/providers"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <ProviderManagement />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <AdminReports />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/activity-report"
              element={
                <ProtectedRoute requireRole="admin">
                  <MainLayout navMode="admin">
                    <ActivityReport />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager"
              element={
                <ProtectedRoute requireRole="manager">
                  <Navigate to="/manager/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/dashboard"
              element={
                <ProtectedRoute requireRole="manager">
                  <MainLayout navMode="manager">
                    <RolePlaceholder
                      title="Manager Dashboard"
                      description="Monitor direct reports, completion rates, and team learning activity."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/team"
              element={
                <ProtectedRoute requireRole="manager">
                  <MainLayout navMode="manager">
                    <RolePlaceholder
                      title="Team Overview"
                      description="View direct reports, assignments, and completion status."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/reports"
              element={
                <ProtectedRoute requireRole="manager">
                  <MainLayout navMode="manager">
                    <RolePlaceholder
                      title="Manager Reports"
                      description="Team-level learning analytics for direct reports."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/coordinator"
              element={
                <ProtectedRoute requireRole={["coordinator", "learningCoordinator"]}>
                  <Navigate to="/coordinator/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/coordinator/dashboard"
              element={
                <ProtectedRoute requireRole={["coordinator", "learningCoordinator"]}>
                  <MainLayout navMode="coordinator">
                    <RolePlaceholder
                      title="Coordinator Dashboard"
                      description="Manage assignments and track department-level progress."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/coordinator/assignments"
              element={
                <ProtectedRoute requireRole={["coordinator", "learningCoordinator"]}>
                  <MainLayout navMode="coordinator">
                    <RolePlaceholder
                      title="Assignments"
                      description="Assign courses to departments, positions, or custom groups."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/coordinator/groups"
              element={
                <ProtectedRoute requireRole={["coordinator", "learningCoordinator"]}>
                  <MainLayout navMode="coordinator">
                    <RolePlaceholder
                      title="Groups"
                      description="Create and manage dynamic or manual groups."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/coordinator/reports"
              element={
                <ProtectedRoute requireRole={["coordinator", "learningCoordinator"]}>
                  <MainLayout navMode="coordinator">
                    <RolePlaceholder
                      title="Coordinator Reports"
                      description="Department-level progress and completion reports."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/coach"
              element={
                <ProtectedRoute requireRole={["coach", "instructionalCoach"]}>
                  <Navigate to="/coach/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/coach/dashboard"
              element={
                <ProtectedRoute requireRole={["coach", "instructionalCoach"]}>
                  <MainLayout navMode="coach">
                    <RolePlaceholder
                      title="Instructional Coach Dashboard"
                      description="Manage course content, versions, and learning design."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/coach/courses"
              element={
                <ProtectedRoute requireRole={["coach", "instructionalCoach"]}>
                  <MainLayout navMode="coach">
                    <RolePlaceholder
                      title="Course Builder"
                      description="Create, publish, and retire courses."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/coach/xapi"
              element={
                <ProtectedRoute requireRole={["coach", "instructionalCoach"]}>
                  <MainLayout navMode="coach">
                    <RolePlaceholder
                      title="xAPI Insights"
                      description="Analyze xAPI activity across all learners."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/corporate"
              element={
                <ProtectedRoute requireRole={["corporate", "hr"]}>
                  <Navigate to="/corporate/dashboard" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/corporate/dashboard"
              element={
                <ProtectedRoute requireRole={["corporate", "hr"]}>
                  <MainLayout navMode="corporate">
                    <RolePlaceholder
                      title="Corporate Dashboard"
                      description="Training oversight and organization-wide visibility."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/corporate/reports"
              element={
                <ProtectedRoute requireRole={["corporate", "hr"]}>
                  <MainLayout navMode="corporate">
                    <RolePlaceholder
                      title="Corporate Reports"
                      description="Exportable training and completion reports."
                    />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard" element={<Navigate to="/learner/dashboard" replace />} />
            <Route path="/courses" element={<Navigate to="/learner/courses" replace />} />
            <Route path="/player/:courseId" element={<LegacyPlayerRedirect />} />
            <Route path="/" element={<Navigate to={getDefaultLandingPath()} replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </CurrentCourseProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
