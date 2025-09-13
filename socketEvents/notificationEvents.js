// socketEvents/notificationEvents.js
const oneSignalService = require('../services/oneSignalService');
const Notifications = require('../models/notifications');

/**
 * Socket.IO events for real-time notifications
 */
const setupNotificationEvents = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join user to their personal room
    socket.on('join_user_room', (username) => {
      socket.join(`user_${username}`);
      console.log(`User ${username} joined their room`);
    });

    // Join user to general notifications room
    socket.on('join_general_room', () => {
      socket.join('general_notifications');
      console.log(`User joined general notifications room`);
    });

    // Handle notification read event
    socket.on('mark_notification_read', async (data) => {
      try {
        const { notificationId, username } = data;
        
        const notification = await Notifications.findById(notificationId);
        if (notification && 
            (notification.notification_type === 'GENERAL' || 
             notification.username === username)) {
          
          notification.is_read = true;
          await notification.save();
          
          // Emit update back to user
          socket.emit('notification_updated', {
            notificationId,
            is_read: true
          });
        }
      } catch (error) {
        console.error('Socket mark notification read error:', error);
        socket.emit('notification_error', {
          message: 'Failed to mark notification as read'
        });
      }
    });

    // Handle get unread count
    socket.on('get_unread_count', async (username) => {
      try {
        const unreadCount = await Notifications.countDocuments({
          $or: [
            { notification_type: 'GENERAL', is_read: false },
            { notification_type: 'SPECIFIC_USER', username: username, is_read: false }
          ]
        });

        socket.emit('unread_count_update', { count: unreadCount });
      } catch (error) {
        console.error('Socket get unread count error:', error);
        socket.emit('notification_error', {
          message: 'Failed to get unread count'
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};

/**
 * Emit real-time notification to user
 */
const emitNotificationToUser = (io, username, notification) => {
  io.to(`user_${username}`).emit('new_notification', notification);
};

/**
 * Emit real-time notification to all users
 */
const emitGeneralNotification = (io, notification) => {
  io.to('general_notifications').emit('new_notification', notification);
};

/**
 * Enhanced OneSignal service with socket integration
 */
const enhancedNotificationService = {
  async sendNotificationWithSocket(io, type, ...args) {
    let result;
    
    switch (type) {
      case 'user_specific':
        const [userEmail, username, title, message, options] = args;
        result = await oneSignalService.sendCombinedNotificationToUser(
          userEmail, username, title, message, options
        );
        
        if (result.inApp?.success) {
          emitNotificationToUser(io, username, result.inApp.notification);
        }
        break;
        
      case 'general':
        const [generalTitle, generalMessage, generalOptions] = args;
        result = await oneSignalService.sendCombinedGeneralNotification(
          generalTitle, generalMessage, generalOptions
        );
        
        if (result.inApp?.success) {
          emitGeneralNotification(io, result.inApp.notification);
        }
        break;
    }
    
    return result;
  },

  async sendOrderNotificationWithSocket(io, order, type = 'creation', oldStatus = null, newStatus = null) {
    let result;
    
    if (type === 'creation') {
      result = await oneSignalService.sendOrderCreationNotification(order);
    } else if (type === 'status_update') {
      result = await oneSignalService.sendOrderStatusUpdateNotification(order, oldStatus, newStatus);
    }
    
    // Emit socket notification
    if (result?.inApp?.success) {
      emitNotificationToUser(io, order.user.username, result.inApp.notification);
    }
    
    return result;
  }
};

module.exports = {
  checkNotificationPermission,
  rateLimitNotifications,
  setupNotificationEvents,
  emitNotificationToUser,
  emitGeneralNotification,
  enhancedNotificationService
};