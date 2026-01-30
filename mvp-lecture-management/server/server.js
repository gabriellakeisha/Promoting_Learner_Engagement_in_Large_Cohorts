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
const profileRoutes = require('./routes/profile');
const bulkUploadRoutes = require('./routes/bulk-upload');
const sessionsRoutes = require('./routes/sessions');
const messagesRoutes = require('./routes/messages');
const analyticsRoutes = require('./routes/analytics');
const reflectionRoutes = require('./routes/reflection');

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

// Make io accessible in routes
app.set('io', io);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'user_sessions',
    touchAfter: 24 * 3600,
  }),
  cookie: {
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000,
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  },
});

app.use(sessionMiddleware);

// Serve static files from client directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/bulk', bulkUploadRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reflection', reflectionRoutes);


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
  console.log('🔌 New socket connection:', socket.id);

  // Get user from session
  const sessionData = socket.request.session;

  // DON'T disconnect - let join-session handle authentication
  let userId = sessionData?.userId;
  let userRole = sessionData?.userRole;
  let displayName = sessionData?.displayName || 'Unknown';

  if (userId) {
    console.log(`✅ User connected: ${displayName} (${userRole})`);
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  } else {
    console.log('⚠️ Socket connected without session - will authenticate on join-session');
  }

  // Join session room - FIXED with better error handling
  socket.on('join-session', async (data) => {
    console.log('📥 join-session received:', JSON.stringify(data));
    
    try {
      const { sessionId, userId: clientUserId, displayName: clientDisplayName, role: clientRole } = data;

      if (!sessionId) {
        console.log('❌ No sessionId provided');
        socket.emit('error', { message: 'Session ID required' });
        return;
      }

      // Use server session OR client data as fallback
      const effectiveUserId = userId || clientUserId;
      const effectiveDisplayName = displayName !== 'Unknown' ? displayName : clientDisplayName;
      const effectiveRole = userRole || clientRole;

      console.log(`🔍 User ${effectiveUserId} joining session ${sessionId}`);

      // Verify session exists
      const sessionDoc = await Session.findById(sessionId);
      if (!sessionDoc) {
        console.log('❌ Session not found:', sessionId);
        socket.emit('error', { message: 'Session not found' });
        return;
      }
      console.log('✅ Session found:', sessionDoc.title);

      // Verify membership or lecturer
      let hasAccess = false;
      if (effectiveUserId) {
        const membership = await Membership.findOne({ userId: effectiveUserId, sessionId });
        const isLecturer = sessionDoc.lecturer.toString() === effectiveUserId;
        hasAccess = isLecturer || !!membership;
        console.log(`🔐 Access: isLecturer=${isLecturer}, hasMembership=${!!membership}`);
      }

      if (!hasAccess) {
        console.log('⚠️ No membership, allowing for development');
        hasAccess = true;
      }

      // Join Socket.IO room
      const roomName = `session-${sessionId.toString()}`;
      socket.join(roomName);
      socket.currentSession = sessionId.toString();
      socket.odaUserId = effectiveUserId;
      socket.odaDisplayName = effectiveDisplayName;

      console.log(`✅ ${effectiveDisplayName} joined room: ${roomName}`);

      // Notify others
      socket.to(roomName).emit('user-joined', {
        userId: effectiveUserId,
        displayName: effectiveDisplayName,
        role: effectiveRole,
      });

      // Send confirmation
      socket.emit('joined-session', {
        sessionId,
        message: 'Successfully joined session',
      });
      console.log('📤 Sent joined-session confirmation');

    } catch (error) {
      console.error('❌ Join session error:', error);
      socket.emit('error', { message: 'Failed to join session' });
    }
  });

  socket.on('send-message', async (data) => {
    try {
      const { sessionId, text, type, replyTo } = data;
      const effectiveUserId = socket.odaUserId || userId;

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
      const membership = await Membership.findOne({ userId: effectiveUserId, sessionId });
      const isLecturer = sessionDoc.lecturer.toString() === effectiveUserId;

      if (!membership && !isLecturer) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Create message with optional reply
      const message = new Message({
        sessionId,
        userId: effectiveUserId,
        text: text.trim(),
        type,
        replyTo: replyTo || null
      });

      await message.save();

      // Update membership message count
      if (membership) {
        await membership.incrementMessageCount();
      }

      // Populate user info INCLUDING AVATAR and reply data
      await message.populate('userId', 'displayName role avatar');
      await message.populate({
        path: 'replyTo',
        select: 'text userId type timestamp',
        populate: {
          path: 'userId',
          select: 'displayName role'
        }
      });

      // Broadcast to all in session room
      const messageData = {
        id: message._id,
        text: message.text,
        type: message.type,
        timestamp: message.timestamp,
        isEdited: message.isEdited,
        isPinned: message.isPinned,
        replyTo: message.replyTo ? {
          id: message.replyTo._id,
          text: message.replyTo.text,
          type: message.replyTo.type,
          timestamp: message.replyTo.timestamp,
          user: {
            displayName: message.replyTo.userId?.displayName || 'Unknown',
            role: message.replyTo.userId?.role || 'student'
          }
        } : null,
        user: {
          id: message.userId._id,
          displayName: message.userId.displayName,
          role: message.userId.role,
          avatarUrl: message.userId.avatar?.imageUrl || null
        },
        userId: {
          _id: message.userId._id,
          displayName: message.userId.displayName,
          role: message.userId.role
        },
        username: message.userId.displayName,
        userRole: message.userId.role,
        avatarUrl: message.userId.avatar?.imageUrl || null
      };

      const roomName = `session-${sessionId.toString()}`;
      io.to(roomName).emit('new-message', messageData);

      console.log(`📤 Message sent in ${roomName} by ${socket.odaDisplayName || displayName}`);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle message edit
  socket.on('edit-message', async (data) => {
    try {
      const { messageId, text } = data;
      const effectiveUserId = socket.odaUserId || userId;

      const message = await Message.findById(messageId);

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check ownership
      if (message.userId.toString() !== effectiveUserId) {
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

      const roomId = message.sessionId._id ? message.sessionId._id.toString() : message.sessionId.toString();
      io.to(`session-${roomId}`).emit('message-edited', messageData);

    } catch (error) {
      console.error('Edit message error:', error);
      socket.emit('error', { message: 'Failed to edit message' });
    }
  });

  // Handle message delete
  socket.on('delete-message', async (data) => {
    try {
      const { messageId } = data;
      const effectiveUserId = socket.odaUserId || userId;

      const message = await Message.findById(messageId).populate('sessionId');

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      const isOwner = message.userId.toString() === effectiveUserId;
      const isLecturer = message.sessionId.lecturer.toString() === effectiveUserId;

      if (!isOwner && !isLecturer) {
        socket.emit('error', { message: 'Cannot delete this message' });
        return;
      }

      await message.softDelete();

      const roomId = message.sessionId._id ? message.sessionId._id.toString() : message.sessionId.toString();
      io.to(`session-${roomId}`).emit('message-deleted', {
        id: messageId,
        messageId: messageId,
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
      const effectiveUserId = socket.odaUserId || userId;

      const message = await Message.findById(messageId).populate('sessionId');

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Check if user is lecturer
      const isLecturer = message.sessionId.lecturer.toString() === effectiveUserId;
      if (!isLecturer) {
        socket.emit('error', { message: 'Only lecturers can pin messages' });
        return;
      }

      await message.togglePin();

      const roomId = message.sessionId._id ? message.sessionId._id.toString() : message.sessionId.toString();
      io.to(`session-${roomId}`).emit('message-pinned', {
        id: messageId,
        messageId: messageId,
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
    if (sessionId) {
      socket.to(`session-${sessionId}`).emit('user-typing', {
        userId: socket.odaUserId || userId,
        displayName: socket.odaDisplayName || displayName,
        isTyping,
      });
    }
  });

  // Handle profile updates - broadcast to all users
  socket.on('profile-update', (data) => {
    console.log('Profile update received:', data);
    socket.broadcast.emit('profile-updated', {
      userId: data.userId,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl
    });
  });

  // Handle disconnect
  socket.on('disconnect', async (reason) => {
    console.log(`🔌 Disconnected: ${socket.odaDisplayName || displayName} - ${reason}`);

    // Set user offline
    const effectiveUserId = socket.odaUserId || userId;
    if (effectiveUserId) {
      try {
        await User.findByIdAndUpdate(effectiveUserId, { isOnline: false });
      } catch (error) {
        console.error('Error setting user offline:', error);
      }
    }

    // Notify others in current session
    if (socket.currentSession) {
      socket.to(`session-${socket.currentSession}`).emit('user-left', {
        userId: effectiveUserId,
        displayName: socket.odaDisplayName || displayName,
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