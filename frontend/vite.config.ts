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
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
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
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
})




