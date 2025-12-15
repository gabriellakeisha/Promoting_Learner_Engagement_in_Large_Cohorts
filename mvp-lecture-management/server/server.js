const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const { connectDB } = require('./config/database');
const User = require('./models/User');
const Session = require('./models/Session');
const Message = require('./models/Message');
const Membership = require('./models/Membership');

// Import routes
const authRoutes = require('./routes/auth');
const bulkUploadRoutes = require('./routes/bulk-upload');
const sessionsRoutes = require('./routes/sessions');
const messagesRoutes = require('./routes/messages');
const analyticsRoutes = require('./routes/analytics');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  },
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'user_sessions',
    touchAfter: 24 * 3600, // Update session once per 24 hours unless changed
  }),
  cookie: {
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  },
});

app.use(sessionMiddleware);

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bulk', bulkUploadRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/register.html'));
});

app.get('/student-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/student-dashboard.html'));
});

app.get('/lecturer-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/lecturer-dashboard.html'));
});

app.get('/chat/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/chat-room.html'));
});

// Socket.IO Configuration
// Share session with Socket.IO
io.engine.use(sessionMiddleware);

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('✅ New socket connection:', socket.id);

  // Get user from session
  const session = socket.request.session;
  
  if (!session || !session.userId) {
    console.log('❌ Unauthorized socket connection');
    socket.disconnect();
    return;
  }

  const userId = session.userId;
  const userRole = session.userRole;
  
  console.log(`👤 User connected: ${session.displayName} (${userRole})`);

  // Set user online
  try {
    await User.findByIdAndUpdate(userId, { isOnline: true });
  } catch (error) {
    console.error('Error setting user online:', error);
  }

  // Join session room
  socket.on('join-session', async (data) => {
    try {
      const { sessionId } = data;
      
      // Verify session exists
      const sessionDoc = await Session.findById(sessionId);
      if (!sessionDoc) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Verify membership or lecturer
      const membership = await Membership.findOne({ userId, sessionId });
      const isLecturer = sessionDoc.lecturer.toString() === userId;

      if (!membership && !isLecturer) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Join Socket.IO room
      socket.join(`session-${sessionId}`);
      socket.currentSession = sessionId;

      console.log(`📡 User ${session.displayName} joined session room: ${sessionId}`);

      // Notify others in the room
      socket.to(`session-${sessionId}`).emit('user-joined', {
        userId,
        displayName: session.displayName,
        role: userRole,
      });

      // Send confirmation
      socket.emit('joined-session', {
        sessionId,
        message: 'Successfully joined session',
      });

    } catch (error) {
      console.error('Join session error:', error);
      socket.emit('error', { message: 'Failed to join session' });
    }
  });

  // Handle new message
  socket.on('send-message', async (data) => {
    try {
      const { sessionId, text, type } = data;

      if (!sessionId || !text || !type) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Verify session
      const sessionDoc = await Session.findById(sessionId);
      if (!sessionDoc || sessionDoc.status !== 'active') {
        socket.emit('error', { message: 'Session not available' });
        return;
      }

      // Verify access
      const membership = await Membership.findOne({ userId, sessionId });
      const isLecturer = sessionDoc.lecturer.toString() === userId;

      if (!membership && !isLecturer) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Create message
      const message = new Message({
        sessionId,
        userId,
        text: text.trim(),
        type,
      });

      await message.save();

      // Update membership message count
      if (membership) {
        await membership.incrementMessageCount();
      }

      // Populate user info
      await message.populate('userId', 'displayName role');

      // Broadcast to all in session room
      const messageData = {
        id: message._id,
        text: message.text,
        type: message.type,
        timestamp: message.timestamp,
        isEdited: message.isEdited,
        isPinned: message.isPinned,
        user: {
          id: message.userId._id,
          displayName: message.userId.displayName,
          role: message.userId.role,
        },
      };

      io.to(`session-${sessionId}`).emit('new-message', messageData);

      console.log(`💬 Message sent in session ${sessionId} by ${session.displayName}`);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle message edit
  socket.on('edit-message', async (data) => {
    try {
      const { messageId, text } = data;

      const message = await Message.findById(messageId);
      
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check ownership
      if (message.userId.toString() !== userId) {
        socket.emit('error', { message: 'Cannot edit others\' messages' });
        return;
      }

      // Check 5-minute window
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (message.timestamp < fiveMinutesAgo) {
        socket.emit('error', { message: 'Edit window expired' });
        return;
      }

      await message.editMessage(text.trim());
      await message.populate('userId', 'displayName role');

      const messageData = {
        id: message._id,
        text: message.text,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
      };

      io.to(`session-${message.sessionId}`).emit('message-edited', messageData);

    } catch (error) {
      console.error('Edit message error:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  });

  // Handle message delete
  socket.on('delete-message', async (data) => {
    try {
      const { messageId } = data;

      const message = await Message.findById(messageId).populate('sessionId');
      
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      const isOwner = message.userId.toString() === userId;
      const isLecturer = message.sessionId.lecturer.toString() === userId;

      if (!isOwner && !isLecturer) {
        socket.emit('error', { message: 'Cannot delete this message' });
        return;
      }

      await message.softDelete();

      io.to(`session-${message.sessionId}`).emit('message-deleted', {
        id: messageId,
      });

    } catch (error) {
      console.error('Delete message error:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  // Handle pin/unpin (lecturer only)
  socket.on('toggle-pin', async (data) => {
    try {
      const { messageId } = data;

      const message = await Message.findById(messageId).populate('sessionId');
      
      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check if user is lecturer
      const isLecturer = message.sessionId.lecturer.toString() === userId;
      if (!isLecturer) {
        socket.emit('error', { message: 'Only lecturers can pin messages' });
        return;
      }

      await message.togglePin();

      io.to(`session-${message.sessionId}`).emit('message-pinned', {
        id: messageId,
        isPinned: message.isPinned,
      });

    } catch (error) {
      console.error('Toggle pin error:', error);
      socket.emit('error', { message: 'Failed to toggle pin' });
    }
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const { sessionId, isTyping } = data;
    
    socket.to(`session-${sessionId}`).emit('user-typing', {
      userId,
      displayName: session.displayName,
      isTyping,
    });
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`👋 User disconnected: ${session.displayName}`);

    // Set user offline
    try {
      await User.findByIdAndUpdate(userId, { isOnline: false });
    } catch (error) {
      console.error('Error setting user offline:', error);
    }

    // Notify others in current session
    if (socket.currentSession) {
      socket.to(`session-${socket.currentSession}`).emit('user-left', {
        userId,
        displayName: session.displayName,
      });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('MVP Lecture Engagement Platform');
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Database: ${process.env.MONGODB_URI}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
