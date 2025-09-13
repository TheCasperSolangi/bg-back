
const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationController');

// Middleware for authentication (adjust based on your auth system)
const authMiddleware = (req, res, next) => {
  // Add your authentication logic here
  // Example:
  // const token = req.headers.authorization?.split(' ')[1];
  // if (!token) return res.status(401).json({ success: false, message: 'Access denied' });
  // ... verify token and set req.user
  next();
};

// Middleware for admin authentication (adjust based on your auth system)
const adminMiddleware = (req, res, next) => {
  // Add your admin authentication logic here
  // Example:
  // if (!req.user?.isAdmin) return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};

// Validation middleware
const validateNotificationData = (req, res, next) => {
  const { title, message } = req.body;
  
  if (!title || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Title is required and cannot be empty'
    });
  }
  
  if (!message || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message is required and cannot be empty'
    });
  }
  
  if (title.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Title cannot exceed 100 characters'
    });
  }
  
  if (message.length > 500) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot exceed 500 characters'
    });
  }
  
  next();
};

// User Routes (require authentication)

/**
 * @route GET /api/notifications/user/:username
 * @desc Get all notifications for a specific user
 * @access Private
 */
router.get('/user/:username', authMiddleware, notificationsController.getUserNotifications);

/**
 * @route GET /api/notifications/user/:username/unread-count
 * @desc Get unread notifications count for a user
 * @access Private
 */
router.get('/user/:username/unread-count', authMiddleware, notificationsController.getUnreadCount);

/**
 * @route PUT /api/notifications/:notificationId/read
 * @desc Mark notification as read
 * @access Private
 */
router.put('/:notificationId/read', authMiddleware, notificationsController.markAsRead);

/**
 * @route PUT /api/notifications/user/:username/read-all
 * @desc Mark all notifications as read for a user
 * @access Private
 */
router.put('/user/:username/read-all', authMiddleware, notificationsController.markAllAsRead);

/**
 * @route GET /api/notifications/:notificationId
 * @desc Get notification by ID
 * @access Private
 */
router.get('/:notificationId', authMiddleware, notificationsController.getNotificationById);

// Admin Routes (require admin authentication)

/**
 * @route GET /api/notifications/admin/all
 * @desc Get all notifications (admin only)
 * @access Admin
 */
router.get('/admin/all', authMiddleware, adminMiddleware, notificationsController.getAllNotifications);

/**
 * @route GET /api/notifications/admin/stats
 * @desc Get notification statistics (admin only)
 * @access Admin
 */
router.get('/admin/stats', authMiddleware, adminMiddleware, notificationsController.getNotificationStats);

/**
 * @route POST /api/notifications/send/user
 * @desc Send notification to specific user
 * @access Admin
 */
router.post('/send/user', 
  authMiddleware, 
  adminMiddleware, 
  validateNotificationData, 
  notificationsController.sendNotificationToUser
);

/**
 * @route POST /api/notifications/send/general
 * @desc Send general notification to all users
 * @access Admin
 */
router.post('/send/general', 
  authMiddleware, 
  adminMiddleware, 
  validateNotificationData, 
  notificationsController.sendGeneralNotification
);

/**
 * @route POST /api/notifications/send/bulk
 * @desc Send bulk notifications to multiple users
 * @access Admin
 */
router.post('/send/bulk', 
  authMiddleware, 
  adminMiddleware, 
  validateNotificationData, 
  notificationsController.sendBulkNotifications
);

/**
 * @route DELETE /api/notifications/:notificationId
 * @desc Delete notification (admin only)
 * @access Admin
 */
router.delete('/:notificationId', 
  authMiddleware, 
  adminMiddleware, 
  notificationsController.deleteNotification
);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Notifications route error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;