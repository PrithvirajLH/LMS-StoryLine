/**
 * Centralized Logging with Pino
 * Production-grade logging with structured output and log levels
 */

// CRITICAL: Load .env FIRST - logger.js is often the first module in the dependency chain
import dotenv from 'dotenv';
dotenv.config();

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// Create logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }
  } : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});

// Create child loggers for different modules
export const createModuleLogger = (module) => logger.child({ module });

// Pre-configured module loggers
export const serverLogger = createModuleLogger('server');
export const xapiLogger = createModuleLogger('xapi');
export const authLogger = createModuleLogger('auth');
export const progressLogger = createModuleLogger('progress');
export const storageLogger = createModuleLogger('storage');
export const blobLogger = createModuleLogger('blob');
export const verbLogger = createModuleLogger('verb-tracker');
export const attemptsLogger = createModuleLogger('attempts');

export default logger;
