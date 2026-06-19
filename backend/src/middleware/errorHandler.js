function errorHandler(err, req, res, next) {
  console.error('[Unhandled Error]:', err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Handle specific Prisma errors
  if (err.code && err.code.startsWith('P')) {
    return res.status(400).json({
      error: 'Database operation failed.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  res.status(status).json({
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
}

module.exports = errorHandler;
