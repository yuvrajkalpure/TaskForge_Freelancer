const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'taskforge-access-token-secret-key-1234';

/**
 * Authenticate JWT access token from request header
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user data from database to check current status (banned, verified)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
        isBanned: true,
        fullName: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been banned by an administrator.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ error: 'Invalid or tampered access token.' });
  }
}

/**
 * Enforce role-based access control (RBAC)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Requires role: [${roles.join(', ')}]. Current role: ${req.user.role}` 
      });
    }

    next();
  };
}

/**
 * Enforce email verification check
 */
function requireVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({ 
      error: 'Email verification required. Please check your inbox or request a new verification link.' 
    });
  }

  next();
}

module.exports = {
  authenticateToken,
  requireRole,
  requireVerified,
};
