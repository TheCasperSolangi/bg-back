const Notifications = require('../models/notifications');

/**
 * Middleware to check if user has permission to access notification
 */
const checkNotificationPermission = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const { username } = req.user || req.body || req.query;

    if (!username) {
      return res.status(401).json({
        success: false,
        message: 'Username is required'
      });
    }

    const notification = await Notifications.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if user can access this notification
    if (notification.notification_type === 'SPECIFIC_USER' && 
        notification.username !== username) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this notification'
      });
    }

    req.notification = notification;
    next();
  } catch (error) {
    console.error('Check notification permission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify notification permissions',
      error: error.message
    });
  }
};

/**
 * Rate limiting middleware for notifications
 */
const rateLimitNotifications = (maxRequests = 100, windowMs = 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    const userRequests = requests.get(identifier) || [];
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many notification requests. Please try again later.'
      });
    }

    validRequests.push(now);
    requests.set(identifier, validRequests);
    next();
  };
};

/**
 * Setup Socket.IO events for notifications
 */
const setupNotificationEvents = (io) => {
  io.on('connection', (socket) => {
    console.log('🔔 New client connected:', socket.id);

    // Example: join a user-specific room
    socket.on('joinNotifications', (username) => {
      socket.join(username);
      console.log(`User ${username} joined notifications room`);
    });

    // Example: send a notification to a user
    socket.on('sendNotification', ({ username, message }) => {
      io.to(username).emit('receiveNotification', { message, date: new Date() });
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });
};

module.exports = {
  checkNotificationPermission,
  rateLimitNotifications,
  setupNotificationEvents
};
