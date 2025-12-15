const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Membership = require('../models/Membership');
const Session = require('../models/Session');
const User = require('../models/User');
const { isAuthenticated, isLecturer } = require('../middleware/auth');

// Get lecturer dashboard analytics for a session
router.get('/lecturer/:sessionId', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify session exists and user is the lecturer
    const session = await Session.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    if (session.lecturer.toString() !== req.session.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    // 1. Total message count
    const totalMessages = await Message.countDocuments({
      sessionId,
      isDeleted: false,
    });

    // 2. Messages by type
    const messagesByType = await Message.aggregate([
      {
        $match: {
          sessionId: session._id,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const typeCounts = {
      QUESTION: 0,
      COMMENT: 0,
      CONFUSION: 0,
    };

    messagesByType.forEach(item => {
      typeCounts[item._id] = item.count;
    });

    // 3. Active users count (users who sent at least 1 message)
    const activeUsers = await Message.distinct('userId', {
      sessionId,
      isDeleted: false,
    });

    const activeUserCount = activeUsers.length;

    // 4. Total members count
    const totalMembers = await Membership.countDocuments({ sessionId });

    // 5. Participation rate
    const participationRate = totalMembers > 0 
      ? ((activeUserCount / totalMembers) * 100).toFixed(1)
      : 0;

    // 6. Timeline data (messages per 5-minute interval)
    const timelineData = await Message.aggregate([
      {
        $match: {
          sessionId: session._id,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d %H:%M',
              date: '$timestamp',
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // 7. Top contributors
    const topContributors = await Message.aggregate([
      {
        $match: {
          sessionId: session._id,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$userId',
          messageCount: { $sum: 1 },
        },
      },
      {
        $sort: { messageCount: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    // Populate user info for top contributors
    const topContributorsWithNames = await Promise.all(
      topContributors.map(async (contributor) => {
        const user = await User.findById(contributor._id).select('displayName email');
        return {
          userId: contributor._id,
          displayName: user?.displayName || 'Unknown',
          email: user?.email || '',
          messageCount: contributor.messageCount,
        };
      })
    );

    // 8. Messages per type over time
    const typeTimeline = await Message.aggregate([
      {
        $match: {
          sessionId: session._id,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: {
            time: {
              $dateToString: {
                format: '%Y-%m-%d %H:%M',
                date: '$timestamp',
              },
            },
            type: '$type',
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.time': 1 },
      },
    ]);

    res.json({
      success: true,
      analytics: {
        summary: {
          totalMessages,
          activeUsers: activeUserCount,
          totalMembers,
          participationRate: parseFloat(participationRate),
        },
        messagesByType: typeCounts,
        timeline: timelineData.map(t => ({
          time: t._id,
          count: t.count,
        })),
        typeTimeline: typeTimeline.map(t => ({
          time: t._id.time,
          type: t._id.type,
          count: t.count,
        })),
        topContributors: topContributorsWithNames,
      },
    });
  } catch (error) {
    console.error('Lecturer analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching analytics',
      error: error.message,
    });
  }
});

// Get student analytics for a session
router.get('/student/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify membership
    const membership = await Membership.findOne({
      userId: req.session.userId,
      sessionId,
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this session',
      });
    }

    // 1. Personal message count
    const myMessageCount = await Message.countDocuments({
      sessionId,
      userId: req.session.userId,
      isDeleted: false,
    });

    // 2. Class average
    const totalMembers = await Membership.countDocuments({ sessionId });
    const totalMessages = await Message.countDocuments({
      sessionId,
      isDeleted: false,
    });

    const classAverage = totalMembers > 0
      ? (totalMessages / totalMembers).toFixed(1)
      : 0;

    // 3. My messages by type
    const myMessagesByType = await Message.aggregate([
      {
        $match: {
          sessionId: membership.sessionId,
          userId: membership.userId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const myTypeCounts = {
      QUESTION: 0,
      COMMENT: 0,
      CONFUSION: 0,
    };

    myMessagesByType.forEach(item => {
      myTypeCounts[item._id] = item.count;
    });

    // 4. Participation rank
    const allParticipants = await Message.aggregate([
      {
        $match: {
          sessionId: membership.sessionId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    const myRank = allParticipants.findIndex(
      p => p._id.toString() === req.session.userId
    ) + 1;

    res.json({
      success: true,
      analytics: {
        personal: {
          messageCount: myMessageCount,
          messagesByType: myTypeCounts,
          rank: myRank || null,
          percentile: myRank && allParticipants.length > 0
            ? ((1 - (myRank - 1) / allParticipants.length) * 100).toFixed(1)
            : null,
        },
        class: {
          average: parseFloat(classAverage),
          totalMessages,
          totalMembers,
          activeMembers: allParticipants.length,
        },
        comparison: {
          aboveAverage: myMessageCount > parseFloat(classAverage),
          difference: (myMessageCount - parseFloat(classAverage)).toFixed(1),
        },
      },
    });
  } catch (error) {
    console.error('Student analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching analytics',
      error: error.message,
    });
  }
});

// Get real-time session stats (for both lecturer and students)
router.get('/live/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Check access
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

    // Get live stats
    const totalMessages = await Message.countDocuments({
      sessionId,
      isDeleted: false,
    });

    const totalMembers = await Membership.countDocuments({ sessionId });

    // Get active users (those currently online - simplified version)
    const recentActiveUsers = await Message.distinct('userId', {
      sessionId,
      timestamp: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
    });

    res.json({
      success: true,
      liveStats: {
        totalMessages,
        totalMembers,
        activeUsers: recentActiveUsers.length,
        sessionStatus: session.status,
      },
    });
  } catch (error) {
    console.error('Live stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching live stats',
      error: error.message,
    });
  }
});

module.exports = router;
