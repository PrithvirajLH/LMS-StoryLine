import axios from 'axios';
import { getCsrfToken, getToken, logout } from './auth';

// Dynamically determine API base URL based on environment
function getApiBaseUrl(): string {
  // If explicitly set in environment variable, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // In browser environment, detect API URL dynamically
  if (typeof window !== 'undefined') {
    // Development mode: Use relative URLs (Vite proxy handles /api routes)
    if (import.meta.env.DEV) {
      return '';
    }
    
    // Production mode: Use window.location.origin
    return window.location.origin;
  }

  return '';
}

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Enable credentials (cookies) for all requests
  withCredentials: true,
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const redirectToLogin = (reason: 'unauthorized' | 'forbidden') => {
  const search = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  window.location.href = `/login${search}`;
};
const forceReauth = async (reason: 'unauthorized' | 'forbidden') => {
  await logout();
  redirectToLogin(reason);
};

// Request interceptor to add auth token and CSRF token
api.interceptors.request.use(
  (config) => {
    // Add CSRF token for state-changing requests
    const csrfToken = getCsrfToken();
    if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase() || '')) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    // Add Bearer token for backwards compatibility
    // (httpOnly cookie is primary, but some clients may need this)
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Initialize retry count
    config.headers['x-retry-count'] = config.headers['x-retry-count'] || '0';
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors with retry logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // Get current retry count
    const retryCount = parseInt(config?.headers?.['x-retry-count'] || '0', 10);
    
    // Check if we should retry (503 = backend starting, or network error)
    const shouldRetry = (
      error.response?.status === 503 || 
      error.code === 'ECONNREFUSED' ||
      error.code === 'ERR_NETWORK'
    ) && retryCount < MAX_RETRIES;
    
    if (shouldRetry && config) {
      // Increment retry count
      config.headers['x-retry-count'] = String(retryCount + 1);
      
      // Wait before retrying (exponential backoff)
      await sleep(RETRY_DELAY * (retryCount + 1));
      
      // Retry logging removed for production (was: console.log)
      return api.request(config);
    }
    
    // Handle 403 (CSRF error) - automatically refresh token and retry
    if (error.response?.status === 403 && error.response?.data?.error === 'Invalid CSRF token') {
      try {
        // Try to refresh CSRF token
        await api.get('/api/auth/csrf');
        // Retry the original request
        return api.request(config);
      } catch {
        // CSRF refresh failed - let the error propagate
      }
    }

    // Handle 401/403 (Unauthorized/Forbidden) - but NOT on login/register pages
    // 409 (Conflict) for "user exists" should NOT trigger logout
    if (error.response?.status === 401 || error.response?.status === 403) {
      const isAuthPage = window.location.pathname.includes('/login') || 
                         window.location.pathname.includes('/register');
      
      if (!isAuthPage) {
        const reason = error.response?.status === 403 ? 'forbidden' : 'unauthorized';
        await forceReauth(reason);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
