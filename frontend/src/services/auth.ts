/**
 * Authentication service
 * 
 * Now uses httpOnly cookies for auth tokens (more secure than localStorage).
 * User data is still stored in localStorage for UI state.
 * CSRF tokens are stored in cookies (readable) and sent in headers.
 */

// Get API base URL - same logic as api.ts for consistency
function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    if (import.meta.env.DEV) {
      return ''; // Development: relative URLs (Vite proxy handles /api)
    }
    return window.location.origin; // Production: use origin
  }
  return '';
}

export interface User {
  userId: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
  role?: string;
  roles?: string[];
  providerId?: string | null;
}

// Cookie name for CSRF token (matches backend)
const CSRF_COOKIE_NAME = 'lms_csrf';

/**
 * Get CSRF token from cookie
 */
export function getCsrfToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Store CSRF token (set by server, we just read it)
 */
export function setCsrfToken(token: string): void {
  // CSRF token is set by the server in a cookie
  // This is kept for backwards compatibility but the server handles it
  localStorage.setItem('csrfToken', token);
}

/**
 * Get auth token - for backwards compatibility with API clients
 * Note: With httpOnly cookies, the browser handles auth automatically
 */
export function getToken(): string | null {
  // Token is now in httpOnly cookie, not accessible from JS
  // Return localStorage token for backwards compatibility only
  return localStorage.getItem('token');
}

/**
 * Set token - for backwards compatibility
 * Note: httpOnly cookie is set by server
 */
export function setToken(token: string): void {
  // Store in localStorage for backwards compatibility with existing code
  localStorage.setItem('token', token);
}

export function removeToken(): void {
  localStorage.removeItem('token');
}

/**
 * Get current user from localStorage
 */
export function getUser(): User | null {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Store user data in localStorage (safe, no sensitive data)
 */
export function setUser(user: User): void {
  localStorage.setItem('user', JSON.stringify(user));
}

export function removeUser(): void {
  localStorage.removeItem('user');
}

/**
 * Check if user is authenticated
 * With httpOnly cookies, we check if user data exists
 */
export function isAuthenticated(): boolean {
  // Check if we have user data (token is in httpOnly cookie)
  return !!getUser() || !!getToken();
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.isAdmin || user?.role === 'admin' || false;
}

function hasRole(user: User | null, role: string): boolean {
  if (!user) return false;

  const isAdminUser = user.isAdmin || user.role === 'admin';
  if (role === 'admin') return isAdminUser;

  const flagName = `is${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  const hasFlag = (user as Record<string, boolean | undefined>)[flagName] === true;
  const hasRoleField = user.role === role;
  const hasRolesArray = Array.isArray(user.roles) ? user.roles.includes(role) : false;

  return hasFlag || hasRoleField || hasRolesArray;
}

function hasAnyRole(user: User | null, roles: string[]): boolean {
  return roles.some((role) => hasRole(user, role));
}

export function getDefaultLandingPath(user: User | null = getUser()): string {
  if (hasRole(user, 'admin')) {
    return '/admin/dashboard';
  }

  if (hasAnyRole(user, ['corporate', 'hr'])) {
    return '/corporate/dashboard';
  }

  if (hasAnyRole(user, ['coach', 'instructionalCoach'])) {
    return '/coach/dashboard';
  }

  if (hasAnyRole(user, ['coordinator', 'learningCoordinator'])) {
    return '/coordinator/dashboard';
  }

  if (hasRole(user, 'manager')) {
    return '/manager/dashboard';
  }

  return '/learner/dashboard';
}

/**
 * Logout - clears local storage and calls server to clear cookies
 */
export async function logout(): Promise<void> {
  try {
    // Use configured API base URL for cross-origin deployments
    const baseUrl = getApiBaseUrl();
    const logoutUrl = `${baseUrl}/api/auth/logout`;
    
    // Call server to clear httpOnly cookies
    const response = await fetch(logoutUrl, {
      method: 'POST',
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken() || '',
      },
    });
    
    if (!response.ok) {
      console.warn('Logout request failed, clearing local data anyway');
    }
  } catch (error) {
    console.warn('Logout request error:', error);
  }
  
  // Always clear local storage
  removeToken();
  removeUser();
  localStorage.removeItem('csrfToken');
}

/**
 * Handle auth response from login/register
 */
export function handleAuthResponse(response: { 
  user: User; 
  token?: string; 
  csrfToken?: string;
}): void {
  // Store user data
  setUser(response.user);
  
  // Store token for backwards compatibility (httpOnly cookie is primary)
  if (response.token) {
    setToken(response.token);
  }
  
  // Store CSRF token if provided
  if (response.csrfToken) {
    setCsrfToken(response.csrfToken);
  }
}
