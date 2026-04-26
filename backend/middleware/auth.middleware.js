/**
 * middleware/auth.middleware.js
 * -----------------------------
 * JWT Authentication Middleware.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      return next();
    } catch (error) {
      console.error('Auth middleware error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token provided' });
};

const protectOrAllowDemo = (...roles) => {
  return (req, res, next) => {
    const demoMode = String(process.env.DEMO_MODE || '').toLowerCase() === 'true';

    if (demoMode) {
      return next();
    }

    return protect(req, res, () => {
      if (!roles.length) {
        return next();
      }

      return authorize(...roles)(req, res, next);
    });
  };
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role '${req.user?.role || 'unknown'}' is not authorized for this action`,
      });
    }
    return next();
  };
};

module.exports = { protect, protectOrAllowDemo, authorize };
