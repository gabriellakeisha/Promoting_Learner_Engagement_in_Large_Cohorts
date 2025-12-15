// Import required packages
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config();

// ============================================
// 1. INITIALIZE EXPRESS APP
// ============================================
const app = express();
const server = http.createServer(app);

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON request bodies
app.use(express.json());

// ============================================
// 2. CONNECT TO MONGODB
// ============================================
let db;
let messagesCollection;

async function connectDB() {
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('backchannel'); // Database name
    messagesCollection = db.collection('messages');
    
    console.log('✅ Connected to MongoDB successfully!');
    
    // Create indexes for better performance
    await messagesCollection.createIndex({ timestamp: -1 });
    console.log('✅ Database indexes created');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1); // Exit if can't connect to database
  }
}

// Connect to database on startup
connectDB();

// ============================================
// 3. SETUP WEBSOCKET SERVER
// ============================================
const wss = new WebSocket.Server({ server });

// Keep track of connected clients
let connectedClients = new Set();

// Handle new WebSocket connections
wss.on('connection', (ws) => {
  console.log('🔌 New client connected');
  connectedClients.add(ws);
  
  // Send welcome message to new client
  ws.send(JSON.stringify({
    type: 'system',
    text: '✅ Connected to chat server',
    timestamp: new Date()
  }));
  
  // Broadcast current user count
  broadcastUserCount();
  
  // Handle incoming messages from client
  ws.on('message', async (data) => {
    try {
      // Parse the message
      const message = JSON.parse(data.toString());
      console.log('📩 Received message:', message);
      
      // Validate message has required fields
      if (!message.username || !message.text) {
        console.error('❌ Invalid message format');
        return;
      }
      
      // Create message document for database
      const messageDoc = {
        username: message.username,
        text: message.text,
        timestamp: new Date(),
        sessionId: message.sessionId || 'default', // Optional: for multi-session support
      };
      
      // Save to MongoDB
      const result = await messagesCollection.insertOne(messageDoc);
      console.log('💾 Message saved to database:', result.insertedId);
      
      // Add the database ID to the message
      messageDoc._id = result.insertedId;
      
      // Broadcast message to all connected clients
      const broadcastMessage = {
        type: 'chat',
        _id: messageDoc._id,
        username: messageDoc.username,
        text: messageDoc.text,
        timestamp: messageDoc.timestamp
      };
      
      broadcast(broadcastMessage);
      
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log('🔌 Client disconnected');
    connectedClients.delete(ws);
    broadcastUserCount();
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// ============================================
// 4. HELPER FUNCTIONS
// ============================================

// Broadcast message to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);
  let sentCount = 0;
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      sentCount++;
    }
  });
  
  console.log(`📡 Broadcast to ${sentCount} clients`);
}

// Broadcast current user count
function broadcastUserCount() {
  const userCount = connectedClients.size;
  broadcast({
    type: 'userCount',
    count: userCount
  });
  console.log(`👥 Active users: ${userCount}`);
}

// ============================================
// 5. REST API ENDPOINTS
// ============================================

// GET /api/messages - Retrieve recent messages from database
app.get('/api/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50; // Default: last 50 messages
    
    const messages = await messagesCollection
      .find({})
      .sort({ timestamp: -1 }) // Most recent first
      .limit(limit)
      .toArray();
    
    // Reverse to show oldest first in chat
    messages.reverse();
    
    console.log(`📊 Retrieved ${messages.length} messages from database`);
    
    res.json({
      success: true,
      count: messages.length,
      messages: messages
    });
  } catch (error) {
    console.error('❌ Error retrieving messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve messages'
    });
  }
});

// GET /api/stats - Get chat statistics
app.get('/api/stats', async (req, res) => {
  try {
    const totalMessages = await messagesCollection.countDocuments();
    const activeUsers = connectedClients.size;
    
    // Get unique users (approximate - based on stored messages)
    const uniqueUsers = await messagesCollection.distinct('username');
    
    res.json({
      success: true,
      stats: {
        totalMessages: totalMessages,
        activeUsers: activeUsers,
        totalUsers: uniqueUsers.length,
        uniqueUsernames: uniqueUsers
      }
    });
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

// POST /api/clear - Clear all messages (for testing)
app.post('/api/clear', async (req, res) => {
  try {
    const result = await messagesCollection.deleteMany({});
    console.log(`🗑️  Cleared ${result.deletedCount} messages`);
    
    res.json({
      success: true,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('❌ Error clearing messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear messages'
    });
  }
});

// ============================================
// 6. START SERVER
// ============================================
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('🚀 BACKCHANNEL CHAT SERVER STARTED');
  console.log('='.repeat(50));
  console.log(`📍 Local:    http://localhost:${PORT}`);
  console.log(`📍 Network:  http://YOUR_IP_ADDRESS:${PORT}`);
  console.log('');
  console.log('📄 Pages:');
  console.log(`   Login:  http://localhost:${PORT}/login.html`);
  console.log(`   Chat:   http://localhost:${PORT}/chat.html`);
  console.log('');
  console.log('🔌 API Endpoints:');
  console.log(`   GET  /api/messages - Retrieve messages`);
  console.log(`   GET  /api/stats    - Get statistics`);
  console.log(`   POST /api/clear    - Clear all messages`);
  console.log('='.repeat(50));
});

// ============================================
// 7. GRACEFUL SHUTDOWN
// ============================================
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  
  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    client.close();
  });
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});