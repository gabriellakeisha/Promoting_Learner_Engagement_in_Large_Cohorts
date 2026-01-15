const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Session = require('../models/Session');
const Membership = require('../models/Membership');
const { isAuthenticated } = require('../middleware/auth');

// Middleware to verify session access
const verifySessionAccess = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const isLecturer = session.lecturer.toString() === userId;
    const membership = await Membership.findOne({ userId, sessionId });

    if (!isLecturer && !membership) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    req.sessionDoc = session;
    req.isLecturer = isLecturer;
    next();
  } catch (error) {
    console.error('Session access verification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Send message - WITH SOCKET.IO BROADCAST
router.post('/send', isAuthenticated, async (req, res) => {
  try {
    const { sessionId, text, type, replyTo, isAnnouncement, identityMode, alias } = req.body;
    const userId = req.session.userId;

    console.log('Sending message:', {
      sessionId,
      type,
      replyTo,
      isAnnouncement,
      from: userId
    });

    // Validate required fields
    if (!sessionId || !text || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify session exists and is active
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Session is not active'
      });
    }

    // Verify user has access
    const isLecturer = session.lecturer.toString() === userId;
    const membership = await Membership.findOne({ userId, sessionId });

    if (!isLecturer && !membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate message type
    const validTypes = ['QUESTION', 'COMMENT', 'CONFUSION'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message type'
      });
    }

    // Validate text length
    if (text.trim().length === 0 || text.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message text must be between 1 and 2000 characters'
      });
    }

    // If replyTo is provided, verify it exists
    if (replyTo) {
      const parentMessage = await Message.findById(replyTo);
      if (!parentMessage || parentMessage.sessionId.toString() !== sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reply reference'
        });
      }
    }

    // Create message
    const message = new Message({
      sessionId,
      userId,
      text: text.trim(),
      type,
      replyTo: replyTo || null,
      isAnnouncement: isAnnouncement || false,
      // NEW: Identity mode fields
      identityMode: identityMode || 'anonymous',
      alias: identityMode === 'pseudonymous' ? alias : null
    });

    await message.save();
    console.log('Message saved:', message._id);

    // Update membership message count
    if (membership) {
      await membership.incrementMessageCount();
    }

    // SOCKET.IO BROADCAST
    try {
      const populatedMessage = await Message.findById(message._id)
        .populate('userId', 'displayName role')
        .populate({
          path: 'replyTo',
          select: 'text userId type timestamp',
          populate: {
            path: 'userId',
            select: 'displayName role'
          }
        });

      console.log('📤 Broadcasting message to session:', sessionId);

      const io = req.app.get('io');

      if (io) {
        const messageData = {
          id: populatedMessage._id.toString(),
          text: populatedMessage.text,
          type: populatedMessage.type,
          timestamp: populatedMessage.createdAt || populatedMessage.timestamp,
          isEdited: populatedMessage.isEdited,
          isPinned: populatedMessage.isPinned,
          isAnnouncement: populatedMessage.isAnnouncement,
          isReported: populatedMessage.isReported,

          // NEW: Identity mode fields
          identityMode: populatedMessage.identityMode || 'identified',
          alias: populatedMessage.alias,

          replyTo: populatedMessage.replyTo ? {
            id: populatedMessage.replyTo._id.toString(),
            text: populatedMessage.replyTo.text,
            type: populatedMessage.replyTo.type,
            timestamp: populatedMessage.replyTo.timestamp,
            user: {
              displayName: populatedMessage.replyTo.userId?.displayName || 'Unknown',
              role: populatedMessage.replyTo.userId?.role || 'student'
            }
          } : null,

          user: {
            id: populatedMessage.userId._id,
            displayName: populatedMessage.userId.displayName,
            role: populatedMessage.userId.role,
            avatarUrl: populatedMessage.userId.avatarUrl
          },
          userId: {
            _id: populatedMessage.userId._id,
            displayName: populatedMessage.userId.displayName,
            role: populatedMessage.userId.role
          },
          username: populatedMessage.userId.displayName,
          userRole: populatedMessage.userId.role
        };


        io.to(`session-${sessionId}`).emit('new-message', messageData);

        console.log('✅ Message broadcasted via Socket.IO');
      } else {
        console.error('❌ Socket.IO instance not found!');
      }
    } catch (broadcastError) {
      console.error('❌ Broadcast error:', broadcastError);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      messageData: {
        id: message._id.toString(),
        text: message.text,
        type: message.type,
        timestamp: message.createdAt || message.timestamp,
        isAnnouncement: message.isAnnouncement,
        isPinned: message.isPinned
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get messages for a session
router.get('/session/:sessionId', isAuthenticated, verifySessionAccess, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    console.log('Fetching messages for session:', sessionId);

    const messages = await Message.find({
      sessionId,
      isDeleted: false
    })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'displayName role')
      .populate({
        path: 'replyTo',
        select: 'text userId type timestamp',
        populate: {
          path: 'userId',
          select: 'displayName role'
        }
      })
      .lean();

    console.log(`Found ${messages.length} messages`);

    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      text: msg.text,
      type: msg.type,
      timestamp: msg.timestamp || msg.createdAt,
      isEdited: msg.isEdited,
      isPinned: msg.isPinned,
      isAnnouncement: msg.isAnnouncement,
      isReported: msg.isReported,
      reactions: msg.reactions,

      // NEW: Identity fields
      identityMode: msg.identityMode || 'identified',
      alias: msg.alias,

      replyTo: msg.replyTo ? {
        id: msg.replyTo._id,
        text: msg.replyTo.text,
        type: msg.replyTo.type,
        timestamp: msg.replyTo.timestamp,
        user: {
          displayName: msg.replyTo.userId?.displayName || 'Unknown',
          role: msg.replyTo.userId?.role || 'student'
        }
      } : null,
      user: {
        id: msg.userId?._id,
        displayName: msg.userId?.displayName || 'Unknown',
        role: msg.userId?.role || 'student',
        avatarUrl: msg.userId?.avatarUrl
      },
      username: msg.userId?.displayName || 'Unknown',
      userRole: msg.userId?.role || 'student'
    }))


    res.json({
      success: true,
      messages: formattedMessages,
      count: formattedMessages.length
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});


// NEW: DELETE MESSAGE (HARD DELETE)

router.delete('/:messageId', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.session.userId;

    const message = await Message.findById(messageId).populate('sessionId');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check permissions: owner can delete own, lecturer can delete any
    const isOwner = message.userId.toString() === userId;
    const isLecturer = message.sessionId.lecturer.toString() === userId;

    if (!isOwner && !isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    // HARD DELETE from MongoDB
    await Message.findByIdAndDelete(messageId);

    console.log(`✅ Message ${messageId} DELETED from MongoDB by ${userId}`);

    // Broadcast deletion via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`session-${message.sessionId._id}`).emit('message-deleted', {
        messageId: messageId,
        deletedBy: userId
      });
      console.log('📤 Deletion broadcasted via Socket.IO');
    }

    res.json({
      success: true,
      message: 'Message permanently deleted'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});


// NEW: REPORT MESSAGE (LECTURER ONLY)

router.post('/:messageId/report', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reason } = req.body;
    const userId = req.session.userId;

    const message = await Message.findById(messageId).populate('sessionId');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is lecturer
    const isLecturer = message.sessionId.lecturer.toString() === userId;
    if (!isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'Only lecturers can report messages'
      });
    }

    // Report the message
    await message.reportMessage(userId, reason || 'Violation reported by lecturer');

    console.log(`🚩 Message ${messageId} REPORTED by ${userId}`);

    // Broadcast report via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`session-${message.sessionId._id}`).emit('message-reported', {
        messageId: messageId,
        isReported: true,
        reportedBy: userId
      });
      console.log('📤 Report broadcasted via Socket.IO');
    }

    res.json({
      success: true,
      message: 'Message reported successfully',
      messageData: {
        id: message._id,
        isReported: message.isReported,
        reportedAt: message.reportedAt
      }
    });

  } catch (error) {
    console.error('Report message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report message'
    });
  }
});


// NEW: UNREPORT MESSAGE (LECTURER ONLY)

router.delete('/:messageId/report', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.session.userId;

    const message = await Message.findById(messageId).populate('sessionId');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is lecturer
    const isLecturer = message.sessionId.lecturer.toString() === userId;
    if (!isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'Only lecturers can unreport messages'
      });
    }

    // Unreport the message
    await message.unreportMessage();

    console.log(`✅ Message ${messageId} UNREPORTED by ${userId}`);

    // Broadcast unreport via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`session-${message.sessionId._id}`).emit('message-reported', {
        messageId: messageId,
        isReported: false
      });
      console.log('📤 Unreport broadcasted via Socket.IO');
    }

    res.json({
      success: true,
      message: 'Report removed successfully'
    });

  } catch (error) {
    console.error('Unreport message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unreport message'
    });
  }
});


// NEW: GET REPORTED MESSAGES (LECTURER ONLY)

router.get('/session/:sessionId/reported', isAuthenticated, verifySessionAccess, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if user is lecturer
    if (!req.isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'Only lecturers can view reported messages'
      });
    }

    const reportedMessages = await Message.getReportedMessages(sessionId);

    res.json({
      success: true,
      messages: reportedMessages,
      count: reportedMessages.length
    });

  } catch (error) {
    console.error('Get reported messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reported messages'
    });
  }
});

// Pin/Unpin message (lecturer only)
router.post('/:messageId/pin', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.session.userId;

    const message = await Message.findById(messageId).populate('sessionId');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is lecturer
    const isLecturer = message.sessionId.lecturer.toString() === userId;
    if (!isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'Only lecturers can pin messages'
      });
    }

    await message.togglePin();

    // Broadcast pin status via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`session-${message.sessionId._id}`).emit('message-pinned', {
        messageId: messageId,
        isPinned: message.isPinned
      });
    }

    res.json({
      success: true,
      message: 'Message pin status updated',
      isPinned: message.isPinned
    });

  } catch (error) {
    console.error('Pin message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pin message'
    });
  }
});

module.exports = router;