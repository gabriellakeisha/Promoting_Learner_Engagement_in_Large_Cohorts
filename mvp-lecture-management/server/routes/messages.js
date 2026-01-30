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

    // Validate message type (NONE is default for students)
    const validTypes = ['NONE', 'QUESTION', 'COMMENT', 'CONFUSION'];
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
      // FIXED: Include 'avatar' in populate
      const populatedMessage = await Message.findById(message._id)
        .populate('userId', 'displayName role avatar')
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
            // FIXED: Correct path to avatar
            avatarUrl: populatedMessage.userId.avatar?.imageUrl || null
          },
          userId: {
            _id: populatedMessage.userId._id,
            displayName: populatedMessage.userId.displayName,
            role: populatedMessage.userId.role
          },
          username: populatedMessage.userId.displayName,
          userRole: populatedMessage.userId.role,
          // FIXED: Also at top level
          avatarUrl: populatedMessage.userId.avatar?.imageUrl || null
        };

        const roomName = `session-${sessionId.toString()}`;
        console.log('📡 Broadcasting to room:', roomName);
        io.to(roomName).emit('new-message', messageData);
        console.log('✅ Message broadcasted via Socket.IO to room:', roomName);
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
      // FIXED: Include 'avatar' in populate
      .populate('userId', 'displayName role avatar')
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
        // FIXED: Correct path to avatar
        avatarUrl: msg.userId?.avatar?.imageUrl || null
      },
      username: msg.userId?.displayName || 'Unknown',
      userRole: msg.userId?.role || 'student',
      // FIXED: Also at top level for easy access
      avatarUrl: msg.userId?.avatar?.imageUrl || null
    }));

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

// DELETE MESSAGE (HARD DELETE)
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

    const isOwner = message.userId.toString() === userId;
    const isLecturer = message.sessionId.lecturer.toString() === userId;

    if (!isOwner && !isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    await Message.findByIdAndDelete(messageId);

    console.log(`✅ Message ${messageId} DELETED from MongoDB by ${userId}`);

    const io = req.app.get('io');
    if (io) {
      // When sessionId is populated, it's an object - use _id
      const roomId = message.sessionId._id ? message.sessionId._id.toString() : message.sessionId.toString();
      console.log('📡 Broadcasting delete to room: session-' + roomId);
      io.to(`session-${roomId}`).emit('message-deleted', {
        messageId: messageId,
        deletedBy: userId
      });
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

// EDIT MESSAGE
router.put('/:messageId', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.session.userId;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required'
      });
    }

    const message = await Message.findById(messageId).populate('sessionId');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const isOwner = message.userId.toString() === userId;
    const isLecturer = message.sessionId.lecturer.toString() === userId;

    if (!isOwner && !isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages'
      });
    }

    message.text = text.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const io = req.app.get('io');
    if (io) {
      const roomId = message.sessionId._id ? message.sessionId._id.toString() : message.sessionId.toString();
      io.to(`session-${roomId}`).emit('message-edited', {
        messageId: messageId,
        text: message.text,
        isEdited: true
      });
    }

    res.json({
      success: true,
      message: 'Message updated successfully'
    });

  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to edit message'
    });
  }
});

// REPORT MESSAGE
router.post('/:messageId/report', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.session.userId;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    message.isReported = true;
    message.reportedBy = userId;
    message.reportedAt = new Date();
    await message.save();

    const io = req.app.get('io');
    if (io) {
      const roomId = message.sessionId._id ? message.sessionId._id.toString() : message.sessionId.toString();
      io.to(`session-${roomId}`).emit('message-reported', {
        messageId: messageId,
        isReported: true
      });
    }

    res.json({
      success: true,
      message: 'Message reported successfully'
    });

  } catch (error) {
    console.error('Report message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report message'
    });
  }
});

// PIN/UNPIN MESSAGE (Lecturer only)
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

    const isLecturer = message.sessionId.lecturer.toString() === userId;
    if (!isLecturer) {
      return res.status(403).json({
        success: false,
        message: 'Only lecturers can pin messages'
      });
    }

    message.isPinned = !message.isPinned;
    await message.save();

    const io = req.app.get('io');
    if (io) {
      const roomId = message.sessionId._id ? message.sessionId._id.toString() : message.sessionId.toString();
      io.to(`session-${roomId}`).emit('message-pinned', {
        messageId: messageId,
        isPinned: message.isPinned
      });
    }

    res.json({
      success: true,
      message: message.isPinned ? 'Message pinned' : 'Message unpinned',
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

// ADD REACTION TO MESSAGE (Max 1 reaction per user per message)
router.post('/:messageId/react', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.session.userId;

    // Validate emoji
    if (!emoji || typeof emoji !== 'string' || emoji.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid emoji'
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Initialize reactions if needed
    if (!message.reactions) {
      message.reactions = new Map();
    }

    // First, remove user from ALL existing reactions (max 1 reaction per user)
    let userPreviousEmoji = null;
    message.reactions.forEach((users, em) => {
      if (Array.isArray(users)) {
        const idx = users.indexOf(userId);
        if (idx > -1) {
          userPreviousEmoji = em;
          users.splice(idx, 1);
          if (users.length === 0) {
            message.reactions.delete(em);
          } else {
            message.reactions.set(em, users);
          }
        }
      }
    });

    // If clicking same emoji = toggle off (don't add back)
    // If clicking different emoji = add user to new emoji
    let action = 'removed';
    if (userPreviousEmoji !== emoji) {
      let usersForEmoji = message.reactions.get(emoji) || [];
      if (!Array.isArray(usersForEmoji)) usersForEmoji = [];
      usersForEmoji.push(userId);
      message.reactions.set(emoji, usersForEmoji);
      action = userPreviousEmoji ? 'changed' : 'added';
    }

    await message.save();

    // Convert Map to plain object
    const reactionsObj = {};
    message.reactions.forEach((users, em) => {
      reactionsObj[em] = users;
    });

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const roomId = message.sessionId._id ? message.sessionId._id.toString() : message.sessionId.toString();
      io.to(`session-${roomId}`).emit('message-reaction', {
        messageId: messageId,
        emoji: emoji,
        reactions: reactionsObj
      });
    }

    res.json({
      success: true,
      message: `Reaction ${action}`,
      reactions: reactionsObj
    });

  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add reaction'
    });
  }
});

module.exports = router;