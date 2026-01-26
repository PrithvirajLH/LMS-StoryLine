import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow access from network
    hmr: {
      // Fix HMR connection issues
      // When accessing from network IP, use the client's host
      clientPort: 5173,
      protocol: 'ws',
      // Vite will automatically detect the correct host
      // For network access, it will use the network IP
    },
    // Prevent stale asset references during HMR
    watch: {
      usePolling: false,
      interval: 100,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.log('Proxy error, backend may be starting...', err.message);
            if (res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend starting, please retry' }));
            }
          });
        },
      },
      '/content': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/xapi': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/launch': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Use /course/ (with trailing slash) to avoid matching /courses
      '/course': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path, // Don't rewrite the path
      },
    },
    // Ensure SPA routing works - Vite should handle this automatically, but explicitly configure it
    fs: {
      strict: false,
    },
    // Prevent stale asset references during development
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  },
  build: {
    // Generate stable chunk names to reduce 404 errors
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        // Use content hash for better cache busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: [],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.ts',
    css: true
  }
})



