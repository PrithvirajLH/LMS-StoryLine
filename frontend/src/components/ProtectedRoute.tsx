import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { isAuthenticated, getUser, setUser, getDefaultLandingPath } from '../services/auth';
import api from '../services/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireRole?: string | string[];
}

function roleMatches(user: ReturnType<typeof getUser>, role: string): boolean {
  if (!user) return false;

  const isAdminUser = user.isAdmin || user.role === 'admin';
  if (role === 'admin') return isAdminUser;

  const flagName = `is${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  const hasFlag = (user as Record<string, boolean | undefined>)[flagName] === true;
  const hasRoleField = user.role === role;
  const hasRolesArray = Array.isArray((user as { roles?: string[] }).roles)
    ? (user as { roles: string[] }).roles.includes(role)
    : false;

  return hasFlag || hasRoleField || hasRolesArray;
}

export default function ProtectedRoute({ children, requireAdmin = false, requireRole }: ProtectedRouteProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      if (!isAuthenticated()) {
        setHasAccess(false);
        setIsChecking(false);
        return;
      }

      const requiredRoles: string[] = [];
      if (requireRole) {
        requiredRoles.push(...(Array.isArray(requireRole) ? requireRole : [requireRole]));
      }
      if (requireAdmin) {
        requiredRoles.push('admin');
      }

      if (requiredRoles.length > 0) {
        // Fetch fresh user data from backend to ensure roles are up to date
        try {
          const response = await api.get('/api/auth/me');
          const user = response.data.user;
          
          // Update localStorage with fresh user data
          setUser(user);
          const isAdminUser = user.isAdmin || user.role === 'admin';
          const hasRole = isAdminUser || requiredRoles.some((role) => roleMatches(user, role));
          setHasAccess(hasRole);
        } catch (error) {
          // If API call fails, check localStorage as fallback
          const user = getUser();
          const isAdminUser = user?.isAdmin || user?.role === 'admin';
          const hasRole = isAdminUser || requiredRoles.some((role) => roleMatches(user, role));
          setHasAccess(!!hasRole);
        }
      } else {
        setHasAccess(true);
      }
      
      setIsChecking(false);
    }

    checkAccess();
  }, [requireAdmin, requireRole]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if ((requireAdmin || requireRole) && !hasAccess) {
    return <Navigate to={getDefaultLandingPath()} replace />;
  }

  return <>{children}</>;
}







