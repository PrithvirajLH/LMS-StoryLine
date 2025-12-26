export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Database connection errors
  if (err.code === 'ESOCKET' || err.code === 'ELOGIN' || err.message?.includes('Failed to connect')) {
    return res.status(503).json({ 
      error: 'Database unavailable. Please configure SQL Server connection.',
      hint: 'Update backend/.env with database credentials'
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found' });
}


