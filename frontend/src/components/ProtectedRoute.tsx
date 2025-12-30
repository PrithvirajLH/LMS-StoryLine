import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { isAuthenticated, getUser, setUser } from '../services/auth';
import api from '../services/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      if (!isAuthenticated()) {
        setHasAccess(false);
        setIsChecking(false);
        return;
      }

      if (requireAdmin) {
        // Fetch fresh user data from backend to ensure isAdmin is up to date
        try {
          const response = await api.get('/api/auth/me');
          const user = response.data.user;
          
          // Update localStorage with fresh user data
          setUser(user);
          
          if (user.isAdmin) {
            setHasAccess(true);
          } else {
            setHasAccess(false);
          }
        } catch (error) {
          // If API call fails, check localStorage as fallback
          const user = getUser();
          if (user?.isAdmin) {
            setHasAccess(true);
          } else {
            setHasAccess(false);
          }
        }
      } else {
        setHasAccess(true);
      }
      
      setIsChecking(false);
    }

    checkAccess();
  }, [requireAdmin]);

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

  if (requireAdmin && !hasAccess) {
    return <Navigate to="/courses" replace />;
  }

  return <>{children}</>;
}







