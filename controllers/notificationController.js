const Notifications = require('../models/notifications');
const oneSignalService = require('../services/oneSignalService');

class NotificationsController {
  /**
   * Get all notifications for a specific user
   */
  async getUserNotifications(req, res) {
    try {
      const { username } = req.params;
      const { page = 1, limit = 20, is_read } = req.query;

      // Build query
      const query = {
        $or: [
          { notification_type: 'GENERAL' },
          { notification_type: 'SPECIFIC_USER', username: username }
        ]
      };

      // Filter by read status if provided
      if (is_read !== undefined) {
        query.is_read = is_read === 'true';
      }

      const notifications = await Notifications.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      const total = await Notifications.countDocuments(query);

      res.status(200).json({
        success: true,
        data: notifications,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_records: total,
          total_pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get user notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: error.message
      });
    }
  }

  /**
   * Get unread notifications count for a user
   */
  async getUnreadCount(req, res) {
    try {
      const { username } = req.params;

      const unreadCount = await Notifications.countDocuments({
        $or: [
          { notification_type: 'GENERAL', is_read: false },
          { notification_type: 'SPECIFIC_USER', username: username, is_read: false }
        ]
      });

      res.status(200).json({
        success: true,
        unread_count: unreadCount
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get unread count',
        error: error.message
      });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const { username } = req.body;

      const notification = await Notifications.findById(notificationId);
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      // Check if user is authorized to mark this notification as read
      if (notification.notification_type === 'SPECIFIC_USER' && notification.username !== username) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this notification'
        });
      }

      notification.is_read = true;
      await notification.save();

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: error.message
      });
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(req, res) {
    try {
      const { username } = req.params;

      const result = await Notifications.updateMany(
        {
          $or: [
            { notification_type: 'GENERAL', is_read: false },
            { notification_type: 'SPECIFIC_USER', username: username, is_read: false }
          ]
        },
        { is_read: true }
      );

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
        modified_count: result.modifiedCount
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: error.message
      });
    }
  }

  /**
   * Send notification to specific user
   */
  async sendNotificationToUser(req, res) {
    try {
      const {
        username,
        user_email,
        title,
        message,
        notification_type = 'both', // 'push', 'in_app', 'both'
        attachments = [],
        href = null
      } = req.body;

      if (!username || !title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Username, title, and message are required'
        });
      }

      let result = {};

      switch (notification_type) {
        case 'push':
          if (!user_email) {
            return res.status(400).json({
              success: false,
              message: 'User email is required for push notifications'
            });
          }
          result = await oneSignalService.sendPushNotification(user_email, title, message, { href });
          break;

        case 'in_app':
          result = await oneSignalService.sendInAppNotificationToUser(username, title, message, { attachments, href });
          break;

        case 'both':
          if (!user_email) {
            return res.status(400).json({
              success: false,
              message: 'User email is required for combined notifications'
            });
          }
          result = await oneSignalService.sendCombinedNotificationToUser(
            user_email, 
            username, 
            title, 
            message, 
            { attachments, href }
          );
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid notification type. Use: push, in_app, or both'
          });
      }

      res.status(200).json({
        success: true,
        message: 'Notification sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Send notification to user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
        error: error.message
      });
    }
  }

  /**
   * Send general notification to all users
   */
  async sendGeneralNotification(req, res) {
    try {
      const {
        title,
        message,
        notification_type = 'both', // 'push', 'in_app', 'both'
        attachments = [],
        href = null
      } = req.body;

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Title and message are required'
        });
      }

      let result = {};

      switch (notification_type) {
        case 'push':
          result = await oneSignalService.sendGeneralPushNotification(title, message, { href });
          break;

        case 'in_app':
          result = await oneSignalService.sendGeneralInAppNotification(title, message, { attachments, href });
          break;

        case 'both':
          result = await oneSignalService.sendCombinedGeneralNotification(title, message, { attachments, href });
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid notification type. Use: push, in_app, or both'
          });
      }

      res.status(200).json({
        success: true,
        message: 'General notification sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Send general notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send general notification',
        error: error.message
      });
    }
  }

  /**
   * Get all notifications (admin only)
   */
  async getAllNotifications(req, res) {
    try {
      const { page = 1, limit = 20, notification_type, status, is_read } = req.query;

      // Build query
      const query = {};
      
      if (notification_type) {
        query.notification_type = notification_type;
      }
      
      if (status) {
        query.status = status;
      }
      
      if (is_read !== undefined) {
        query.is_read = is_read === 'true';
      }

      const notifications = await Notifications.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      const total = await Notifications.countDocuments(query);

      res.status(200).json({
        success: true,
        data: notifications,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_records: total,
          total_pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get all notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: error.message
      });
    }
  }

  /**
   * Delete notification (admin only)
   */
  async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params;

      const notification = await Notifications.findByIdAndDelete(notificationId);
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
        data: notification
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: error.message
      });
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(req, res) {
    try {
      const { notificationId } = req.params;
      const { username } = req.query;

      const notification = await Notifications.findById(notificationId);
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      // Check if user is authorized to view this notification
      if (notification.notification_type === 'SPECIFIC_USER' && 
          notification.username !== username) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this notification'
        });
      }

      res.status(200).json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error('Get notification by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification',
        error: error.message
      });
    }
  }

  /**
   * Get notification statistics (admin only)
   */
  async getNotificationStats(req, res) {
    try {
      const stats = await Notifications.aggregate([
        {
          $group: {
            _id: null,
            total_notifications: { $sum: 1 },
            general_notifications: {
              $sum: { $cond: [{ $eq: ['$notification_type', 'GENERAL'] }, 1, 0] }
            },
            specific_notifications: {
              $sum: { $cond: [{ $eq: ['$notification_type', 'SPECIFIC_USER'] }, 1, 0] }
            },
            read_notifications: {
              $sum: { $cond: ['$is_read', 1, 0] }
            },
            unread_notifications: {
              $sum: { $cond: ['$is_read', 0, 1] }
            },
            delivered_notifications: {
              $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] }
            }
          }
        }
      ]);

      const result = stats[0] || {
        total_notifications: 0,
        general_notifications: 0,
        specific_notifications: 0,
        read_notifications: 0,
        unread_notifications: 0,
        delivered_notifications: 0
      };

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get notification stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification statistics',
        error: error.message
      });
    }
  }

  /**
   * Bulk send notifications to multiple users
   */
  async sendBulkNotifications(req, res) {
    try {
      const {
        usernames = [],
        user_emails = [],
        title,
        message,
        notification_type = 'both',
        attachments = [],
        href = null
      } = req.body;

      if (!title || !message || (usernames.length === 0 && user_emails.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Title, message, and at least one username or email are required'
        });
      }

      const results = [];
      const errors = [];

      // Process each user
      for (let i = 0; i < Math.max(usernames.length, user_emails.length); i++) {
        const username = usernames[i];
        const userEmail = user_emails[i];

        try {
          let result = {};

          switch (notification_type) {
            case 'push':
              if (userEmail) {
                result = await oneSignalService.sendPushNotification(userEmail, title, message, { href });
              }
              break;

            case 'in_app':
              if (username) {
                result = await oneSignalService.sendInAppNotificationToUser(username, title, message, { attachments, href });
              }
              break;

            case 'both':
              if (username && userEmail) {
                result = await oneSignalService.sendCombinedNotificationToUser(
                  userEmail, 
                  username, 
                  title, 
                  message, 
                  { attachments, href }
                );
              }
              break;
          }

          results.push({
            username: username || 'N/A',
            email: userEmail || 'N/A',
            result
          });
        } catch (error) {
          errors.push({
            username: username || 'N/A',
            email: userEmail || 'N/A',
            error: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Bulk notifications processed',
        data: {
          successful: results,
          failed: errors,
          total_processed: results.length + errors.length
        }
      });
    } catch (error) {
      console.error('Send bulk notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send bulk notifications',
        error: error.message
      });
    }
  }
}

module.exports = new NotificationsController();