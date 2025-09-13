const axios = require('axios');
const crypto = require('crypto');
const Notifications = require('../models/notifications'); // Adjust path as needed

class OneSignalService {
  constructor() {
    this.appId = process.env.ONESIGNAL_APP_ID;
    this.apiKey = process.env.ONESIGNAL_API_KEY;
    this.baseUrl = 'https://onesignal.com/api/v1';
    
    if (!this.appId || !this.apiKey) {
      console.warn('OneSignal credentials not configured. Push notifications will be disabled.');
    }
  }

  /**
   * Generate unique notification code
   */
  generateNotificationCode() {
    return `NOTIF_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  /**
   * Save in-app notification to database
   * @param {object} notificationData - Notification data
   */
  async saveInAppNotification(notificationData) {
    try {
      const notification = new Notifications({
        notification_code: notificationData.notification_code || this.generateNotificationCode(),
        notification_type: notificationData.notification_type,
        username: notificationData.username,
        notification_title: notificationData.notification_title,
        notification_text: notificationData.notification_text,
        notification_attachments: notificationData.notification_attachments || [],
        notification_href: notificationData.notification_href,
        is_read: false,
        status: 'DELIVERED'
      });

      await notification.save();
      return { success: true, notification };
    } catch (error) {
      console.error('Save in-app notification error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to specific user
   * @param {string} userEmail - User's email address
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {object} data - Additional data to send with notification
   */
  async sendPushNotification(userEmail, title, message, data = {}) {
    if (!this.appId || !this.apiKey) {
      console.log('OneSignal not configured, skipping push notification');
      return { success: false, message: 'OneSignal not configured' };
    }

    try {
      const payload = {
        app_id: this.appId,
        filters: [
          { field: 'email', value: userEmail }
        ],
        headings: { en: title },
        contents: { en: message },
        data: data,
        web_push_topic: 'notifications'
      };

      const response = await axios.post(`${this.baseUrl}/notifications`, payload, {
        headers: {
          'Authorization': `Basic ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        notificationId: response.data.id,
        recipients: response.data.recipients
      };
    } catch (error) {
      console.error('Push notification error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0] || error.message
      };
    }
  }

  /**
   * Send push notification to all users (general notification)
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {object} data - Additional data to send with notification
   */
  async sendGeneralPushNotification(title, message, data = {}) {
    if (!this.appId || !this.apiKey) {
      console.log('OneSignal not configured, skipping general push notification');
      return { success: false, message: 'OneSignal not configured' };
    }

    try {
      const payload = {
        app_id: this.appId,
        included_segments: ['All'],
        headings: { en: title },
        contents: { en: message },
        data: data,
        web_push_topic: 'general_notifications'
      };

      const response = await axios.post(`${this.baseUrl}/notifications`, payload, {
        headers: {
          'Authorization': `Basic ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        notificationId: response.data.id,
        recipients: response.data.recipients
      };
    } catch (error) {
      console.error('General push notification error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0] || error.message
      };
    }
  }

  /**
   * Send in-app notification to specific user
   * @param {string} username - Target username
   * @param {string} title - Notification title
   * @param {string} text - Notification text
   * @param {object} options - Additional options
   */
  async sendInAppNotificationToUser(username, title, text, options = {}) {
    try {
      const notificationData = {
        notification_code: this.generateNotificationCode(),
        notification_type: 'SPECIFIC_USER',
        username: username,
        notification_title: title,
        notification_text: text,
        notification_attachments: options.attachments || [],
        notification_href: options.href || null,
        is_read: false,
        status: 'DELIVERED'
      };

      const result = await this.saveInAppNotification(notificationData);
      return result;
    } catch (error) {
      console.error('Send in-app notification to user error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send in-app notification to all users (general)
   * @param {string} title - Notification title
   * @param {string} text - Notification text
   * @param {object} options - Additional options
   */
  async sendGeneralInAppNotification(title, text, options = {}) {
    try {
      const notificationData = {
        notification_code: this.generateNotificationCode(),
        notification_type: 'GENERAL',
        username: 'ALL_USERS', // Placeholder for general notifications
        notification_title: title,
        notification_text: text,
        notification_attachments: options.attachments || [],
        notification_href: options.href || null,
        is_read: false,
        status: 'DELIVERED'
      };

      const result = await this.saveInAppNotification(notificationData);
      return result;
    } catch (error) {
      console.error('Send general in-app notification error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send combined notification (both push and in-app) to specific user
   * @param {string} userEmail - User's email for push notification
   * @param {string} username - Username for in-app notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message/text
   * @param {object} options - Additional options
   */
  async sendCombinedNotificationToUser(userEmail, username, title, message, options = {}) {
    try {
      const pushData = {
        type: options.type || 'general',
        href: options.href,
        notification_code: options.notification_code || this.generateNotificationCode(),
        ...options.pushData
      };

      // Send both notifications concurrently
      const [pushResult, inAppResult] = await Promise.allSettled([
        this.sendPushNotification(userEmail, title, message, pushData),
        this.sendInAppNotificationToUser(username, title, message, {
          attachments: options.attachments,
          href: options.href
        })
      ]);

      return {
        push: pushResult.status === 'fulfilled' ? pushResult.value : { success: false, error: pushResult.reason },
        inApp: inAppResult.status === 'fulfilled' ? inAppResult.value : { success: false, error: inAppResult.reason }
      };
    } catch (error) {
      console.error('Send combined notification to user error:', error.message);
      return {
        push: { success: false, error: error.message },
        inApp: { success: false, error: error.message }
      };
    }
  }

  /**
   * Send combined notification (both push and in-app) to all users
   * @param {string} title - Notification title
   * @param {string} message - Notification message/text
   * @param {object} options - Additional options
   */
  async sendCombinedGeneralNotification(title, message, options = {}) {
    try {
      const pushData = {
        type: options.type || 'general_announcement',
        href: options.href,
        notification_code: options.notification_code || this.generateNotificationCode(),
        ...options.pushData
      };

      // Send both notifications concurrently
      const [pushResult, inAppResult] = await Promise.allSettled([
        this.sendGeneralPushNotification(title, message, pushData),
        this.sendGeneralInAppNotification(title, message, {
          attachments: options.attachments,
          href: options.href
        })
      ]);

      return {
        push: pushResult.status === 'fulfilled' ? pushResult.value : { success: false, error: pushResult.reason },
        inApp: inAppResult.status === 'fulfilled' ? inAppResult.value : { success: false, error: inAppResult.reason }
      };
    } catch (error) {
      console.error('Send combined general notification error:', error.message);
      return {
        push: { success: false, error: error.message },
        inApp: { success: false, error: error.message }
      };
    }
  }

  /**
   * Send email notification to specific user
   * @param {string} userEmail - User's email address
   * @param {string} subject - Email subject
   * @param {string} htmlContent - HTML email content
   * @param {object} data - Additional data
   */
  async sendEmailNotification(userEmail, subject, htmlContent, data = {}) {
    if (!this.appId || !this.apiKey) {
      console.log('OneSignal not configured, skipping email notification');
      return { success: false, message: 'OneSignal not configured' };
    }

    try {
      const payload = {
        app_id: this.appId,
        filters: [
          { field: 'email', value: userEmail }
        ],
        email_subject: subject,
        email_body: htmlContent,
        email_from_name: process.env.EMAIL_FROM_NAME || 'Your Store',
        email_from_address: process.env.EMAIL_FROM_ADDRESS || 'noreply@yourstore.com',
        data: data
      };

      const response = await axios.post(`${this.baseUrl}/notifications`, payload, {
        headers: {
          'Authorization': `Basic ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        notificationId: response.data.id,
        recipients: response.data.recipients
      };
    } catch (error) {
      console.error('Email notification error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0] || error.message
      };
    }
  }

  /**
   * Send order creation notifications (push, in-app, and email)
   * @param {object} order - Order object
   */
  async sendOrderCreationNotification(order) {
    const { user, order_code, total, payment_method, items } = order;
    
    // Notification content
    const title = '🎉 Order Confirmed!';
    const message = `Your order ${order_code} has been placed successfully. Total: $${total.toFixed(2)}`;
    
    const options = {
      type: 'order_created',
      href: `/orders/${order_code}`,
      notification_code: this.generateNotificationCode(),
      pushData: {
        order_code,
        total,
        url: `/orders/${order_code}`
      }
    };

    // Email content
    const emailSubject = `Order Confirmation - ${order_code}`;
    const emailHtml = this.generateOrderCreationEmailTemplate(order);

    // Send all three types of notifications
    const [combinedResult, emailResult] = await Promise.allSettled([
      this.sendCombinedNotificationToUser(user.email, user.username, title, message, options),
      this.sendEmailNotification(user.email, emailSubject, emailHtml, options.pushData)
    ]);

    const combined = combinedResult.status === 'fulfilled' ? combinedResult.value : { push: { success: false }, inApp: { success: false } };
    
    return {
      push: combined.push,
      inApp: combined.inApp,
      email: emailResult.status === 'fulfilled' ? emailResult.value : { success: false, error: emailResult.reason }
    };
  }

  /**
   * Send order status update notifications
   * @param {object} order - Order object
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   */
  async sendOrderStatusUpdateNotification(order, oldStatus, newStatus) {
    const { user, order_code, total } = order;
    
    const statusMessages = {
      'pending': { title: '⏳ Order Pending', message: 'Your order is being reviewed.' },
      'processing': { title: '🔄 Order Processing', message: 'We\'re preparing your order.' },
      'paid': { title: '💳 Payment Confirmed', message: 'Your payment has been received.' },
      'shipped': { title: '🚚 Order Shipped', message: 'Your order is on its way!' },
      'delivered': { title: '📦 Order Delivered', message: 'Your order has been delivered.' },
      'cancelled': { title: '❌ Order Cancelled', message: 'Your order has been cancelled.' },
      'refunded': { title: '💰 Order Refunded', message: 'Your refund is being processed.' },
      'on hold': { title: '⏸️ Order On Hold', message: 'Your order is temporarily on hold.' }
    };

    const statusInfo = statusMessages[newStatus.toLowerCase()] || {
      title: '📋 Order Update',
      message: `Your order status has been updated to: ${newStatus}`
    };

    // Combined notification content
    const title = statusInfo.title;
    const message = `Order ${order_code}: ${statusInfo.message}`;
    
    const options = {
      type: 'order_status_update',
      href: `/orders/${order_code}/track`,
      notification_code: this.generateNotificationCode(),
      pushData: {
        order_code,
        old_status: oldStatus,
        new_status: newStatus,
        url: `/orders/${order_code}/track`
      }
    };

    // Email content
    const emailSubject = `Order Update - ${order_code} | ${statusInfo.title}`;
    const emailHtml = this.generateOrderUpdateEmailTemplate(order, oldStatus, newStatus, statusInfo);

    // Send all three types of notifications
    const [combinedResult, emailResult] = await Promise.allSettled([
      this.sendCombinedNotificationToUser(user.email, user.username, title, message, options),
      this.sendEmailNotification(user.email, emailSubject, emailHtml, options.pushData)
    ]);

    const combined = combinedResult.status === 'fulfilled' ? combinedResult.value : { push: { success: false }, inApp: { success: false } };
    
    return {
      push: combined.push,
      inApp: combined.inApp,
      email: emailResult.status === 'fulfilled' ? emailResult.value : { success: false, error: emailResult.reason }
    };
  }

  // ... (keeping all the existing email template methods)
  
  /**
   * Generate HTML email template for order creation
   * @param {object} order - Order object
   */
  generateOrderCreationEmailTemplate(order) {
    const { user, order_code, total, payment_method, items, billing_address, shipping_address, special_instructions } = order;
    
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          ${item.product_id?.product_name || 'Product'}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
          $${item.price.toFixed(2)}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
          $${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🎉 Order Confirmed!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Thank you for your purchase, ${user.full_name || user.username}!</p>
          </div>

          <!-- Order Details -->
          <div style="padding: 30px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <h2 style="margin: 0 0 15px 0; color: #333; font-size: 20px;">Order Details</h2>
              <p style="margin: 5px 0; color: #666;"><strong>Order Code:</strong> ${order_code}</p>
              <p style="margin: 5px 0; color: #666;"><strong>Order Date:</strong> ${new Date(order.createdAt || Date.now()).toLocaleDateString()}</p>
              <p style="margin: 5px 0; color: #666;"><strong>Payment Method:</strong> ${payment_method}</p>
              <p style="margin: 5px 0; color: #666;"><strong>Total Amount:</strong> <span style="color: #28a745; font-weight: bold; font-size: 18px;">$${total.toFixed(2)}</span></p>
            </div>

            <!-- Items Table -->
            <h3 style="color: #333; margin-bottom: 15px;">Order Items</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f8f9fa;">
                  <th style="padding: 15px 12px; text-align: left; font-weight: bold; color: #333; border-bottom: 2px solid #ddd;">Item</th>
                  <th style="padding: 15px 12px; text-align: center; font-weight: bold; color: #333; border-bottom: 2px solid #ddd;">Qty</th>
                  <th style="padding: 15px 12px; text-align: right; font-weight: bold; color: #333; border-bottom: 2px solid #ddd;">Price</th>
                  <th style="padding: 15px 12px; text-align: right; font-weight: bold; color: #333; border-bottom: 2px solid #ddd;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <!-- Addresses -->
            <div style="display: flex; gap: 20px; margin-bottom: 25px;">
              <div style="flex: 1; background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Billing Address</h4>
                <p style="margin: 0; color: #666; white-space: pre-line;">${billing_address || 'Not provided'}</p>
              </div>
              <div style="flex: 1; background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Shipping Address</h4>
                <p style="margin: 0; color: #666; white-space: pre-line;">${shipping_address || 'Not provided'}</p>
              </div>
            </div>

            ${special_instructions ? `
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
              <h4 style="margin: 0 0 10px 0; color: #856404;">Special Instructions</h4>
              <p style="margin: 0; color: #856404;">${special_instructions}</p>
            </div>
            ` : ''}

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://yourstore.com'}/orders/${order_code}/track" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Track Your Order
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
            <p style="margin: 0;">Thank you for choosing us! If you have any questions, please contact our support team.</p>
            <p style="margin: 10px 0 0 0;">
              <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@yourstore.com'}" style="color: #667eea;">Contact Support</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML email template for order updates
   * @param {object} order - Order object
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @param {object} statusInfo - Status information
   */
  generateOrderUpdateEmailTemplate(order, oldStatus, newStatus, statusInfo) {
    const { user, order_code, total } = order;
    
    const statusColors = {
      'pending': '#ffc107',
      'processing': '#17a2b8',
      'paid': '#28a745',
      'shipped': '#007bff',
      'delivered': '#28a745',
      'cancelled': '#dc3545',
      'refunded': '#6f42c1',
      'on hold': '#fd7e14'
    };

    const statusColor = statusColors[newStatus.toLowerCase()] || '#6c757d';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Status Update</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background-color: ${statusColor}; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${statusInfo.title}</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Order ${order_code} Status Update</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <p style="font-size: 18px; color: #333; margin: 0 0 10px 0;">Hello ${user.full_name || user.username},</p>
              <p style="font-size: 16px; color: #666; margin: 0;">${statusInfo.message}</p>
            </div>

            <!-- Status Progress -->
            <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
              <h3 style="margin: 0 0 20px 0; color: #333;">Status Update</h3>
              <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 20px;">
                <span style="padding: 8px 16px; background-color: #e9ecef; color: #6c757d; border-radius: 20px; font-size: 14px; text-transform: capitalize;">${oldStatus}</span>
                <span style="color: #28a745; font-size: 20px;">→</span>
                <span style="padding: 8px 16px; background-color: ${statusColor}; color: white; border-radius: 20px; font-size: 14px; font-weight: bold; text-transform: capitalize;">${newStatus}</span>
              </div>
              
              <div style="background-color: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor};">
                <h4 style="margin: 0 0 10px 0; color: #333;">Order Information</h4>
                <p style="margin: 5px 0; color: #666;"><strong>Order Code:</strong> ${order_code}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Updated:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <!-- CTA Buttons -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://yourstore.com'}/orders/${order_code}/track" 
                 style="display: inline-block; background-color: ${statusColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 10px 10px 0;">
                Track Order
              </a>
              <a href="${process.env.FRONTEND_URL || 'https://yourstore.com'}/orders/${order_code}" 
                 style="display: inline-block; background-color: #6c757d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 0 10px 10px;">
                View Order
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
            <p style="margin: 0;">Thank you for choosing us! If you have any questions, please contact our support team.</p>
            <p style="margin: 10px 0 0 0;">
              <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@yourstore.com'}" style="color: ${statusColor};">Contact Support</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send bulk notifications to multiple users
   * @param {Array} userEmails - Array of user emails
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {object} data - Additional data
   */
  async sendBulkNotification(userEmails, title, message, data = {}) {
    if (!this.appId || !this.apiKey) {
      console.log('OneSignal not configured, skipping bulk notification');
      return { success: false, message: 'OneSignal not configured' };
    }

    try {
      const payload = {
        app_id: this.appId,
        filters: userEmails.map((email, index) => {
          const filter = { field: 'email', value: email };
          return index === 0 ? filter : { ...filter, operator: 'OR' };
        }),
        headings: { en: title },
        contents: { en: message },
        data: data
      };

      const response = await axios.post(`${this.baseUrl}/notifications`, payload, {
        headers: {
          'Authorization': `Basic ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        notificationId: response.data.id,
        recipients: response.data.recipients
      };
    } catch (error) {
      console.error('Bulk notification error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0] || error.message
      };
    }
  }
}

module.exports = new OneSignalService();