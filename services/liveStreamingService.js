const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');

module.exports = function initLiveStreaming(server) {
  const wss = new WebSocketServer({ server });

  const clients = new Map(); // id -> { ws, role }
  let broadcasterId = null;

  function send(ws, obj) {
    try {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(obj));
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  function relay(toId, obj) {
    const target = clients.get(toId);
    if (target && target.ws.readyState === target.ws.OPEN) {
      send(target.ws, obj);
    }
  }

  function broadcast(obj, excludeId = null) {
    for (const [id, client] of clients) {
      if (id !== excludeId) {
        send(client.ws, obj);
      }
    }
  }

  wss.on('connection', (ws) => {
    const id = uuidv4();
    clients.set(id, { ws, role: null });
    
    console.log(`Client ${id} connected`);
    send(ws, { type: 'welcome', id, broadcasterId });

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (error) {
        console.error('Invalid JSON message:', error);
        return;
      }
      
      msg.from = id;
      console.log(`Message from ${id}:`, msg.type);

      switch (msg.type) {
        case 'register-broadcaster':
          clients.get(id).role = 'broadcaster';
          broadcasterId = id;
          console.log(`Broadcaster ${id} registered`);
          
          // Notify all existing viewers that broadcaster is now available
          for (const [clientId, client] of clients) {
            if (clientId !== id && client.role === 'viewer') {
              send(client.ws, { type: 'broadcaster-available', broadcasterId });
            }
          }
          break;

        case 'viewer':
          clients.get(id).role = 'viewer';
          console.log(`Viewer ${id} registered`);
          
          if (broadcasterId && clients.has(broadcasterId)) {
            // Tell broadcaster that a viewer wants to join
            relay(broadcasterId, { type: 'viewer-wants-to-join', viewerId: id });
          } else {
            send(ws, { type: 'error', message: 'No broadcaster live right now.' });
          }
          break;

        case 'offer':
          console.log(`Relaying offer from ${id} to ${msg.to}`);
          relay(msg.to, { type: 'offer', from: id, offer: msg.offer });
          break;

        case 'answer':
          console.log(`Relaying answer from ${id} to ${msg.to}`);
          relay(msg.to, { type: 'answer', from: id, answer: msg.answer });
          break;

        case 'candidate':
        case 'ice-candidate':
          console.log(`Relaying ICE candidate from ${id} to ${msg.to}`);
          if (msg.to) {
            relay(msg.to, { type: 'candidate', from: id, candidate: msg.candidate });
          } else {
            console.error('No recipient specified for ICE candidate');
          }
          break;

        case 'end-broadcast':
          if (id === broadcasterId) {
            console.log(`Broadcast ended by ${id}`);
            broadcasterId = null;
            // Notify all viewers that broadcast ended
            for (const [clientId, client] of clients) {
              if (client.role === 'viewer') {
                send(client.ws, { type: 'broadcast-ended' });
              }
            }
          }
          break;

        default:
          console.log(`Unknown message type: ${msg.type}`);
      }
    });

    ws.on('close', () => {
      console.log(`Client ${id} disconnected`);
      clients.delete(id);
      
      if (id === broadcasterId) {
        console.log('Broadcaster disconnected');
        broadcasterId = null;
        // Notify all viewers that broadcast ended
        for (const [clientId, client] of clients) {
          if (client.role === 'viewer') {
            send(client.ws, { type: 'broadcast-ended' });
          }
        }
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${id}:`, error);
    });
  });

  console.log('✅ Live Streaming Service initialized');
};