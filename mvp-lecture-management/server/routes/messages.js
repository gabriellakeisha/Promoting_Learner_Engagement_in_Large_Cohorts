const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Session = require('../models/Session');
const Membership = require('../models/Membership');
const { isAuthenticated } = require('../middleware/auth');

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

router.post('/send', isAuthenticated, async (req, res) => {
  try {
    const { sessionId, text, type, replyTo, isAnnouncement, identityMode, alias, attachment } = req.body;
    const userId = req.session.userId;

    console.log('Sending message:', {
      sessionId,
      type,
      replyTo,
      isAnnouncement,
      from: userId
    });

    if (!sessionId || (!text && !attachment) || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

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

    const isLecturer = session.lecturer.toString() === userId;
    const membership = await Membership.findOne({ userId, sessionId });

    if (!isLecturer && !membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const validTypes = ['NONE', 'QUESTION', 'COMMENT', 'CONFUSION'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message type'
      });
    }

    if (text && (text.trim().length === 0 && !attachment || text.length > 2000)) {
      if (!attachment) {
        return res.status(400).json({
          success: false,
          message: 'Message text must be between 1 and 2000 characters'
        });
      }
    }

    if (replyTo) {
      const parentMessage = await Message.findById(replyTo);
      if (!parentMessage || parentMessage.sessionId.toString() !== sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reply reference'
        });
      }
    }

    const message = new Message({
      sessionId,
      userId,
      text: text ? text.trim() : '',
      type,
      replyTo: replyTo || null,
      isAnnouncement: isAnnouncement || false,
      identityMode: identityMode || 'anonymous',
      alias: identityMode === 'pseudonymous' ? alias : null,
      attachment: attachment || null
    });

    await message.save();
    console.log('Message saved:', message._id);

    if (membership) {
      await membership.incrementMessageCount();
    }

    try {
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

      console.log('Broadcasting message to session:', sessionId);

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
          attachment: populatedMessage.attachment || null,

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
            avatarUrl: populatedMessage.userId.avatar?.imageUrl || null
          },
          userId: {
            _id: populatedMessage.userId._id,
            displayName: populatedMessage.userId.displayName,
            role: populatedMessage.userId.role
          },
          username: populatedMessage.userId.displayName,
          userRole: populatedMessage.userId.role,
          avatarUrl: populatedMessage.userId.avatar?.imageUrl || null
        };

        const roomName = `session-${sessionId.toString()}`;
        console.log('Broadcasting to room:', roomName);
        io.to(roomName).emit('new-message', messageData);
        console.log('Message broadcasted via Socket.IO to room:', roomName);
      } else {
        console.error('Socket.IO instance not found!');
      }
    } catch (broadcastError) {
      console.error('Broadcast error:', broadcastError);
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
        isPinned: message.isPinned,
        attachment: message.attachment || null
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

router.get('/session/:sessionId', isAuthenticated, verifySessionAccess, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    console.log('Fetching messages for session:', sessionId);

    const messages = await Message.find({
      sessionId,
      isDeleted: { $in: [false, true, null] }
    })
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(limit)
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
      editedAt: msg.editedAt || null,
      isDeleted: msg.isDeleted || false,
      deletedAt: msg.deletedAt || null,
      isPinned: msg.isPinned,
      isAnnouncement: msg.isAnnouncement,
      isReported: msg.isReported,
      reactions: msg.reactions,
      attachment: msg.attachment || null,

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
        avatarUrl: msg.userId?.avatar?.imageUrl || null
      },
      username: msg.userId?.displayName || 'Unknown',
      userRole: msg.userId?.role || 'student',
      avatarUrl: msg.userId?.avatar?.imageUrl || null,

      isPoll: msg.isPoll || false,
      poll: msg.isPoll && msg.poll ? {
        question: msg.poll.question,
        options: msg.poll.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          voteCount: opt.votes ? opt.votes.length : 0,
          hasVoted: opt.votes ? opt.votes.some(v => v.toString() === req.session.userId) : false
        })),
        allowMultiple: msg.poll.allowMultiple,
        isAnonymous: msg.poll.isAnonymous,
        isClosed: msg.poll.isClosed,
        totalVotes: msg.poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0)
      } : null
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

    await message.softDelete(userId);

    console.log(`Message ${messageId} soft deleted by ${userId}`);

    const io = req.app.get('io');
    if (io) {
      const roomId = message.sessionId._id ? message.sessionId._id.toString() : message.sessionId.toString();
      io.to(`session-${roomId}`).emit('message-deleted', {
        messageId: messageId,
        deletedBy: userId,
        isDeleted: true
      });
    }

    res.json({
      success: true,
      message: 'Message deleted'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

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

    if (!message.originalText) {
      message.originalText = message.text;
    }
    if (!message.editHistory) {
      message.editHistory = [];
    }
    message.editHistory.push({
      text: message.text,
      editedAt: new Date()
    });
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

router.post('/:messageId/react', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.session.userId;

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

    if (!message.reactions) {
      message.reactions = new Map();
    }

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

    let action = 'removed';
    if (userPreviousEmoji !== emoji) {
      let usersForEmoji = message.reactions.get(emoji) || [];
      if (!Array.isArray(usersForEmoji)) usersForEmoji = [];
      usersForEmoji.push(userId);
      message.reactions.set(emoji, usersForEmoji);
      action = userPreviousEmoji ? 'changed' : 'added';
    }

    await message.save();

    const reactionsObj = {};
    message.reactions.forEach((users, em) => {
      reactionsObj[em] = users;
    });

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

router.post('/poll/create', isAuthenticated, async (req, res) => {
  try {
    const { sessionId, question, options, allowMultiple, isAnonymous } = req.body;
    const userId = req.session.userId;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.lecturer.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Only lecturers can create polls' });
    }

    if (!question || !options || options.length < 2) {
      return res.status(400).json({ success: false, message: 'Poll must have a question and at least 2 options' });
    }

    if (options.length > 10) {
      return res.status(400).json({ success: false, message: 'Poll cannot have more than 10 options' });
    }

    const pollOptions = options.map((opt, index) => ({
      id: `opt_${index}_${Date.now()}`,
      text: opt.trim(),
      votes: []
    }));

    const message = new Message({
      sessionId,
      userId,
      text: question,
      type: 'POLL',
      isPoll: true,
      poll: {
        question,
        options: pollOptions,
        allowMultiple: allowMultiple || false,
        isAnonymous: isAnonymous !== false,
        isClosed: false
      }
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('userId', 'displayName role avatar');

    const io = req.app.get('io');
    if (io) {
      const pollData = {
        id: populatedMessage._id.toString(),
        text: question,
        type: 'POLL',
        isPoll: true,
        timestamp: populatedMessage.createdAt || populatedMessage.timestamp,
        user: {
          id: populatedMessage.userId._id,
          displayName: populatedMessage.userId.displayName,
          role: populatedMessage.userId.role,
          avatarUrl: populatedMessage.userId.avatar?.imageUrl || null
        },
        username: populatedMessage.userId.displayName,
        userRole: populatedMessage.userId.role,
        avatarUrl: populatedMessage.userId.avatar?.imageUrl || null,
        poll: {
          question,
          options: pollOptions.map(opt => ({
            id: opt.id,
            text: opt.text,
            voteCount: 0,
            hasVoted: false
          })),
          allowMultiple: allowMultiple || false,
          isAnonymous: isAnonymous !== false,
          isClosed: false,
          totalVotes: 0
        }
      };

      io.to(`session-${sessionId}`).emit('new-message', pollData);
    }

    res.status(201).json({
      success: true,
      message: 'Poll created',
      pollId: message._id
    });

  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ success: false, message: 'Failed to create poll' });
  }
});

router.post('/poll/:messageId/vote', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { optionIds } = req.body;
    const userId = req.session.userId;

    const message = await Message.findById(messageId);
    if (!message || !message.isPoll) {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }

    if (message.poll.isClosed) {
      return res.status(400).json({ success: false, message: 'Poll is closed' });
    }

    message.poll.options.forEach(opt => {
      const idx = opt.votes.indexOf(userId);
      if (idx > -1) opt.votes.splice(idx, 1);
    });

    const ids = Array.isArray(optionIds) ? optionIds : [optionIds];
    if (!message.poll.allowMultiple && ids.length > 1) {
      return res.status(400).json({ success: false, message: 'Only one vote allowed' });
    }

    ids.forEach(optId => {
      const option = message.poll.options.find(o => o.id === optId);
      if (option) option.votes.push(userId);
    });

    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`session-${message.sessionId}`).emit('poll-update', {
        pollId: messageId,
        options: message.poll.options.map(opt => ({
          id: opt.id,
          voteCount: opt.votes.length
        }))
      });
    }

    res.json({ success: true, message: 'Vote recorded' });

  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ success: false, message: 'Failed to vote' });
  }
});

router.post('/poll/:messageId/close', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.session.userId;

    const message = await Message.findById(messageId).populate('sessionId');
    if (!message || !message.isPoll) {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }

    if (message.sessionId.lecturer.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Only lecturers can close polls' });
    }

    message.poll.isClosed = true;
    await message.save();

    const io = req.app.get('io');
    if (io) {
      const roomId = message.sessionId._id ? message.sessionId._id.toString() : message.sessionId.toString();
      io.to(`session-${roomId}`).emit('poll-closed', { pollId: messageId });
    }

    res.json({ success: true, message: 'Poll closed' });

  } catch (error) {
    console.error('Close poll error:', error);
    res.status(500).json({ success: false, message: 'Failed to close poll' });
  }
});

module.exports = router;