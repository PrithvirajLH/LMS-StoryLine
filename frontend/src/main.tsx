import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Handle 404 asset errors during HMR - reload page if assets fail to load
if (import.meta.env.DEV) {
  let reloadTimeout: ReturnType<typeof setTimeout> | null = null;
  let reloadCount = 0;
  const MAX_RELOADS = 3;

  const handleAssetError = (event: ErrorEvent | Event) => {
    const target = event.target as HTMLElement | null;
    
    // Check if it's a script or link tag with a Vite asset
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      const src = target.tagName === 'SCRIPT' 
        ? (target as HTMLScriptElement).src 
        : (target as HTMLLinkElement).href || '';
      
      if (src && src.includes('/assets/') && (src.includes('.js') || src.includes('.css'))) {
        reloadCount++;
        
        if (reloadCount <= MAX_RELOADS) {
          console.warn(`[Vite] Asset 404 detected (${reloadCount}/${MAX_RELOADS}), reloading page...`, src);
          
          // Clear any existing timeout
          if (reloadTimeout) {
            clearTimeout(reloadTimeout);
          }
          
          // Delay reload to avoid rapid-fire reloads
          reloadTimeout = setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          console.error('[Vite] Too many reload attempts. Please manually refresh the page.');
        }
      }
    }
  };

  // Listen for script/link loading errors
  window.addEventListener('error', handleAssetError, true);
  
  // Also handle unhandled promise rejections (module loading errors)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason && typeof reason === 'object' && 'message' in reason) {
      const message = String(reason.message);
      if (message.includes('Failed to fetch dynamically imported module') || 
          message.includes('Loading chunk') ||
          message.includes('404')) {
        handleAssetError(event as any);
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)







