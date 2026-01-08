const express = require('express');
const router = express.Router();
const Message = require('../models/message'); // lowercase 'm' to match your file
const Membership = require('../models/Membership');
const Session = require('../models/Session');
const { isAuthenticated } = require('../middleware/auth');

// ============================================
// GET MESSAGES FOR A SESSION
// ✅ FIXED: Route path matches frontend call
// Frontend calls: /api/messages/session/:sessionId
// ============================================
router.get('/session/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, before } = req.query;
    
    console.log('📥 Fetching messages for session:', sessionId);
    console.log('User ID from session:', req.session.userId);

    // Check if session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Check access permissions
    const membership = await Membership.findOne({
      userId: req.session.userId,
      sessionId,
    });

    const isLecturer = session.lecturer.toString() === req.session.userId;

    if (!membership && !isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must join the session first.',
      });
    }

    // Build query
    const query = {
      sessionId,
      isDeleted: false,
    };

    // Add "before" filter for pagination (load older messages)
    if (before) {
      query._id = { $lt: before };
    }

    // Fetch messages
    const messages = await Message.find(query)
      .sort({ timestamp: 1 }) // Oldest first for chat display
      .limit(parseInt(limit))
      .populate('userId', 'displayName role email');

    console.log(`✅ Found ${messages.length} messages`);

    res.json({
      success: true,
      messages: messages.map(m => ({
        id: m._id,
        text: m.text,
        type: m.type,
        timestamp: m.timestamp,
        createdAt: m.createdAt || m.timestamp, // Support both fields
        isEdited: m.isEdited,
        editedAt: m.editedAt,
        isPinned: m.isPinned,
        userId: {
          _id: m.userId._id,
          displayName: m.userId.displayName,
          role: m.userId.role,
          email: m.userId.email
        }
      })),
      hasMore: messages.length === parseInt(limit),
    });
  } catch (error) {
    console.error('❌ Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching messages',
      error: error.message,
    });
  }
});

// ============================================
// SEND NEW MESSAGE
// ✅ Endpoint: POST /api/messages/send
// ============================================
router.post('/send', isAuthenticated, async (req, res) => {
  try {
    const { sessionId, text, type } = req.body;

    console.log('📤 Sending message:', { sessionId, type, from: req.session.userId });

    // Validation
    if (!sessionId || !text || !type) {
      return res.status(400).json({
        success: false,
        message: 'Session ID, text, and type are required',
      });
    }

    if (!['QUESTION', 'COMMENT', 'CONFUSION'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message type. Must be QUESTION, COMMENT, or CONFUSION',
      });
    }

    // Check if session exists and is active
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send messages to ended session',
      });
    }

    // Check membership
    const membership = await Membership.findOne({
      userId: req.session.userId,
      sessionId,
    });

    const isLecturer = session.lecturer.toString() === req.session.userId;

    if (!membership && !isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must join the session first.',
      });
    }

    // Create message
    const message = new Message({
      sessionId,
      userId: req.session.userId,
      text: text.trim(),
      type,
    });

    await message.save();

    // Update membership message count (if student)
    if (membership) {
      await membership.incrementMessageCount();
    }

    // Populate user info for response
    await message.populate('userId', 'displayName role email');

    console.log('✅ Message saved:', message._id);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      messageData: {
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
      },
    });
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error sending message',
      error: error.message,
    });
  }
});

// ============================================
// EDIT MESSAGE (own messages only, within 5 minutes)
// ✅ Endpoint: PUT /api/messages/:messageId
// ============================================
router.put('/:messageId', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required',
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check ownership
    if (message.userId.toString() !== req.session.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages',
      });
    }

    // Check if message is already deleted
    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit deleted message',
      });
    }

    // Check 5-minute window
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.timestamp < fiveMinutesAgo) {
      return res.status(400).json({
        success: false,
        message: 'Messages can only be edited within 5 minutes of posting',
      });
    }

    // Update message
    await message.editMessage(text.trim());
    await message.populate('userId', 'displayName role');

    res.json({
      success: true,
      message: 'Message updated successfully',
      messageData: {
        id: message._id,
        text: message.text,
        type: message.type,
        timestamp: message.timestamp,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
        user: {
          id: message.userId._id,
          displayName: message.userId.displayName,
          role: message.userId.role,
        },
      },
    });
  } catch (error) {
    console.error('❌ Edit message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error editing message',
      error: error.message,
    });
  }
});

// ============================================
// DELETE MESSAGE (own messages or lecturer can delete any)
// ✅ Endpoint: DELETE /api/messages/:messageId
// ============================================
router.delete('/:messageId', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId)
      .populate('sessionId');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    const isOwner = message.userId.toString() === req.session.userId;
    const isLecturer = message.sessionId.lecturer.toString() === req.session.userId;

    // Check permissions
    if (!isOwner && !isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages',
      });
    }

    // Soft delete
    await message.softDelete();

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting message',
      error: error.message,
    });
  }
});

// ============================================
// PIN/UNPIN MESSAGE (lecturer only)
// ✅ Endpoint: POST /api/messages/:messageId/pin
// ============================================
router.post('/:messageId/pin', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId)
      .populate('sessionId');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check if user is lecturer
    const isLecturer = message.sessionId.lecturer.toString() === req.session.userId;

    if (!isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'Only lecturers can pin messages',
      });
    }

    await message.togglePin();
    await message.populate('userId', 'displayName role');

    res.json({
      success: true,
      message: message.isPinned ? 'Message pinned' : 'Message unpinned',
      messageData: {
        id: message._id,
        isPinned: message.isPinned,
      },
    });
  } catch (error) {
    console.error('❌ Pin message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling pin',
      error: error.message,
    });
  }
});

// ============================================
// GET PINNED MESSAGES FOR SESSION
// ✅ Endpoint: GET /api/messages/session/:sessionId/pinned
// ============================================
router.get('/session/:sessionId/pinned', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check access
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    const membership = await Membership.findOne({
      userId: req.session.userId,
      sessionId,
    });

    const isLecturer = session.lecturer.toString() === req.session.userId;

    if (!membership && !isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    const pinnedMessages = await Message.find({
      sessionId,
      isPinned: true,
      isDeleted: false,
    })
      .sort({ timestamp: -1 })
      .populate('userId', 'displayName role');

    res.json({
      success: true,
      messages: pinnedMessages.map(m => ({
        id: m._id,
        text: m.text,
        type: m.type,
        timestamp: m.timestamp,
        user: {
          id: m.userId._id,
          displayName: m.userId.displayName,
          role: m.userId.role,
        },
      })),
    });
  } catch (error) {
    console.error('❌ Get pinned messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching pinned messages',
      error: error.message,
    });
  }
});

module.exports = router;