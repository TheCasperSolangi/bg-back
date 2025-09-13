// websocket/notificationWebSocket.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken'); // Adjust based on your auth system

class NotificationWebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.clients = new Map(); // Map of username -> WebSocket connection
    
    this.wss.on('connection', this.handleConnection.bind(this));
  }

  handleConnection(ws, req) {
    console.log('New WebSocket connection');
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      // Remove client from authenticated clients
      for (const [username, client] of this.clients.entries()) {
        if (client === ws) {
          this.clients.delete(username);
          console.log(`Client ${username} disconnected`);
          break;
        }
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  handleMessage(ws, message) {
    switch (message.type) {
      case 'authenticate':
        this.authenticateClient(ws, message.token);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  authenticateClient(ws, token) {
    try {
      // Verify JWT token (adjust based on your auth system)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const username = decoded.username; // Adjust based on your token structure
      
      // Store authenticated client
      this.clients.set(username, ws);
      
      ws.send(JSON.stringify({ type: 'authenticated', username }));
      console.log(`Client ${username} authenticated`);
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
    }
  }

  // Send notification to specific user
  sendNotificationToUser(username, notification) {
    const client = this.clients.get(username);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'new_notification',
        notification
      }));
      return true;
    }
    return false;
  }

  // Send notification to all connected users
  broadcastNotification(notification) {
    const message = JSON.stringify({
      type: 'new_notification',
      notification
    });

    this.clients.forEach((client, username) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Send notification update
  sendNotificationUpdate(username, update) {
    const client = this.clients.get(username);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'notification_updated',
        update
      }));
    }
  }

  // Send notification deletion
  sendNotificationDeleted(username, notificationId) {
    const client = this.clients.get(username);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'notification_deleted',
        notificationId
      }));
    }
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.clients.size;
  }

  // Get connected users list
  getConnectedUsers() {
    return Array.from(this.clients.keys());
  }
}