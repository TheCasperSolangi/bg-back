const jwt = require('jsonwebtoken');
const Auth = require('../models/Auth');

// Middleware for authentication
const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get full user info from DB to ensure role is up-to-date
    const authUser = await Auth.findById(decoded.id).select('-password');
    if (!authUser) return res.status(401).json({ message: 'User not found' });

    req.user = authUser; // This will include user_type
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Middleware for role-based authorization
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.user_type)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };