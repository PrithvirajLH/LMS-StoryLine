/**
 * Centralized Error Handling
 * Custom error classes and error handling middleware
 */

import logger from './logger.js';

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

/**
 * xAPI specific error
 */
export class XAPIError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, 'XAPI_ERROR');
    this.name = 'XAPIError';
  }
}

// ============================================================================
// Error Response Formatter
// ============================================================================

/**
 * Format error for API response
 */
function formatErrorResponse(err, req) {
  const isDev = process.env.NODE_ENV !== 'production';
  
  const response = {
    error: err.message || 'An unexpected error occurred',
    code: err.code || 'INTERNAL_ERROR',
    requestId: req.id,
  };
  
  if (err.details) {
    response.details = err.details;
  }
  
  if (isDev && err.stack) {
    response.stack = err.stack;
  }
  
  return response;
}

// ============================================================================
// Error Handling Middleware
// ============================================================================

/**
 * Async handler wrapper - catches async errors and passes to error middleware
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req, res, next) {
  next(new NotFoundError('Endpoint'));
}

/**
 * Global error handler middleware
 */
export function errorHandler(err, req, res, next) {
  // Default to 500 if no status code
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';
  
  // Handle specific error types
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (err.name === 'SyntaxError' && err.status === 400) {
    statusCode = 400;
    message = 'Invalid JSON';
    code = 'INVALID_JSON';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service unavailable';
    code = 'SERVICE_UNAVAILABLE';
  }
  
  // Log error
  const logData = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    statusCode,
    error: message,
    code,
  };
  
  if (statusCode >= 500) {
    logger.error({ ...logData, stack: err.stack }, 'Server error');
  } else if (statusCode >= 400) {
    logger.warn(logData, 'Client error');
  }
  
  // Send error response
  res.status(statusCode).json(formatErrorResponse({
    ...err,
    message,
    statusCode,
    code,
  }, req));
}

/**
 * Helper to send xAPI error response
 */
export function sendXapiError(res, error, req = {}) {
  const message = error?.message || 'xAPI error';
  let statusCode = error?.statusCode || 500;
  
  if (message.includes('Authentication')) {
    statusCode = 401;
  } else if (message.includes('Actor does not match') || message.includes('Access denied')) {
    statusCode = 403;
  } else if (message.includes('not found')) {
    statusCode = 404;
  } else if (message.includes('required') || message.includes('Invalid')) {
    statusCode = 400;
  }
  
  const response = {
    error: message,
    requestId: req.id,
  };
  
  if (process.env.NODE_ENV !== 'production' && error?.stack) {
    response.stack = error.stack;
  }
  
  res.status(statusCode).json(response);
}

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  XAPIError,
  asyncHandler,
  notFoundHandler,
  errorHandler,
  sendXapiError,
};
