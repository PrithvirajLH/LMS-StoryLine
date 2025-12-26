import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPool, closePool } from './config/database.js';

// Import routes
import authRoutes from './routes/auth.js';
import coursesRoutes from './routes/courses-table.js'; // Using Table Storage version
import contentRoutes from './routes/content.js';
import xapiRoutes from './routes/xapi.js';
import usersRoutes from './routes/users-table.js'; // Using Table Storage version
import adminRoutes from './routes/admin-table.js'; // Using Table Storage version

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/content', contentRoutes);
app.use('/xapi', xapiRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database connection (Azure Table Storage)
getPool()
  .then(() => {
    console.log('✓ Azure Table Storage connected');
    startServer();
  })
  .catch((error) => {
    console.warn('⚠ Table Storage connection failed:', error.message);
    console.warn('⚠ Server will start without database. Some features will be unavailable.');
    console.warn('⚠ To enable full functionality, set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY in backend/.env');
    startServer();
  });

function startServer() {
  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Health check: http://localhost:${PORT}/health`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing connections...');
  await closePool();
  process.exit(0);
});


