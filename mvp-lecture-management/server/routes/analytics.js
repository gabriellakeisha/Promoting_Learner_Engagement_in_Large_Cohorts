const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Membership = require('../models/Membership');
const Session = require('../models/Session');
const User = require('../models/User');
const { isAuthenticated, isLecturer } = require('../middleware/auth');
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

    // ========================================
    // 1. BASIC COUNTS
    // ========================================
    const totalMessages = await Message.countDocuments({
      sessionId,
      isDeleted: false,
    });

    // 2. Messages by type
    const messagesByType = await Message.aggregate([
      { $match: { sessionId: session._id, isDeleted: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const typeCounts = { QUESTION: 0, COMMENT: 0, CONFUSION: 0 };
    messagesByType.forEach(item => {
      typeCounts[item._id] = item.count;
    });

    // ========================================
    // 3. ACTIVE USERS vs TOTAL MEMBERS (Contributors vs Consumers)
    // ========================================
    const activeUserIds = await Message.distinct('userId', {
      sessionId,
      isDeleted: false,
    });
    const activeUserCount = activeUserIds.length;

    const totalMembers = await Membership.countDocuments({ sessionId });
    
    // Consumers = members who haven't posted
    const consumersCount = totalMembers - activeUserCount;
    
    const participationRate = totalMembers > 0 
      ? ((activeUserCount / totalMembers) * 100).toFixed(1)
      : 0;

    // ========================================
    // 4. ENGAGEMENT OVER TIME (Messages per 5-minute intervals)
    // ========================================
    const engagementTimeline = await Message.aggregate([
      { $match: { sessionId: session._id, isDeleted: false } },
      {
        $group: {
          _id: {
            $toDate: {
              $subtract: [
                { $toLong: '$timestamp' },
                { $mod: [{ $toLong: '$timestamp' }, 300000] } // 5 min = 300000ms
              ]
            }
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Format timeline for chart
    const timeline = engagementTimeline.map(t => ({
      time: new Date(t._id).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      fullTime: t._id,
      count: t.count,
    }));

    // ========================================
    // 5. MESSAGES PER MINUTE (Recent activity rate)
    // ========================================
    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000);

    const messagesLast5Min = await Message.countDocuments({
      sessionId,
      isDeleted: false,
      timestamp: { $gte: fiveMinutesAgo }
    });

    const messagesLast10Min = await Message.countDocuments({
      sessionId,
      isDeleted: false,
      timestamp: { $gte: tenMinutesAgo }
    });

    const messagesPerMinute = (messagesLast5Min / 5).toFixed(1);

    // ========================================
    // 6. TOP 5 CONTRIBUTORS (Students only)
    // ========================================
    const topContributors = await Message.aggregate([
      { $match: { sessionId: session._id, isDeleted: false } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $match: { 'user.role': { $ne: 'lecturer' } } },
      { $group: { _id: '$userId', messageCount: { $sum: 1 } } },
      { $sort: { messageCount: -1 } },
      { $limit: 5 },
    ]);

    const topContributorsWithNames = await Promise.all(
      topContributors.map(async (c) => {
        const user = await User.findById(c._id).select('displayName email');
        return {
          userId: c._id,
          displayName: user?.displayName || 'Anonymous',
          email: user?.email || 'N/A',
          messageCount: c.messageCount,
        };
      })
    );

    // ========================================
    // 7. IDENTITY MODE BREAKDOWN 
    // ========================================
    const identityModeBreakdown = await Message.aggregate([
      { $match: { sessionId: session._id, isDeleted: false } },
      { 
        $group: { 
          _id: { $ifNull: ['$identityMode', 'identified'] }, 
          count: { $sum: 1 } 
        } 
      },
    ]);

    const identityModes = { anonymous: 0, pseudonymous: 0, identified: 0 };
    identityModeBreakdown.forEach(item => {
      identityModes[item._id] = item.count;
    });

    // ========================================
    // 8. KEYWORD FREQUENCY (Most common words)
    // ========================================
    const allMessages = await Message.find({
      sessionId,
      isDeleted: false,
    }).select('text');

    // Simple keyword extraction (exclude common stop words)
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once',
      'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
      'more', 'most', 'other-', 'some', 'such', 'no', 'nor', 'not', 'only',
      'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but',
      'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these',
      'those', 'what', 'which', 'who', 'whom', 'i', 'me', 'my', 'we', 'our',
      'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they',
      'them', 'their', 'am', 'get', 'got', 'also', 'like', 'know', 'think',
      'dont', "don't", 'im', "i'm", 'about', 'yes', 'yeah', 'ok', 'okay'
    ]);

    const wordCounts = {};
    allMessages.forEach(msg => {
      const words = msg.text.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
      
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });

    // Get top 15 keywords
    const keywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }));

    // ========================================
    // 9. PEAK ACTIVITY TIME
    // ========================================
    const peakActivity = timeline.reduce((max, current) => 
      current.count > (max?.count || 0) ? current : max, null
    );

    // ========================================
    // 10. CONFUSION INDICATOR (% of confusion messages)
    // ========================================
    const confusionRate = totalMessages > 0 
      ? ((typeCounts.CONFUSION / totalMessages) * 100).toFixed(1)
      : 0;

    // ========================================
    // 11. QUESTION RATE
    // ========================================
    const questionRate = totalMessages > 0 
      ? ((typeCounts.QUESTION / totalMessages) * 100).toFixed(1)
      : 0;

    // ========================================
    // SEND RESPONSE
    // ========================================
    res.json({
      success: true,
      analytics: {
        // Summary stats
        summary: {
          totalMessages,
          activeUsers: activeUserCount,
          totalMembers,
          consumersCount, // Users who only read, didn't post
          participationRate: parseFloat(participationRate),
          messagesPerMinute: parseFloat(messagesPerMinute),
          messagesLast5Min,
          messagesLast10Min,
        },
        
        // Message breakdown
        messagesByType: typeCounts,
        confusionRate: parseFloat(confusionRate),
        questionRate: parseFloat(questionRate),
        
        // Identity mode stats 
        identityModes,
        
        // Timeline for charts
        timeline,
        peakActivity,
        
        // Top contributors
        topContributors: topContributorsWithNames,
        
        // Keywords 
        keywords,
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

// ============================================
// STUDENT ANALYTICS (Keep existing)
// ============================================
router.get('/student/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;

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

    const myMessageCount = await Message.countDocuments({
      sessionId,
      userId: req.session.userId,
      isDeleted: false,
    });

    const totalMembers = await Membership.countDocuments({ sessionId });
    const totalMessages = await Message.countDocuments({
      sessionId,
      isDeleted: false,
    });

    const classAverage = totalMembers > 0
      ? (totalMessages / totalMembers).toFixed(1)
      : 0;

    const myMessagesByType = await Message.aggregate([
      {
        $match: {
          sessionId: membership.sessionId,
          userId: membership.userId,
          isDeleted: false,
        },
      },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const myTypeCounts = { QUESTION: 0, COMMENT: 0, CONFUSION: 0 };
    myMessagesByType.forEach(item => {
      myTypeCounts[item._id] = item.count;
    });

    const allParticipants = await Message.aggregate([
      { $match: { sessionId: membership.sessionId, isDeleted: false } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
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

// ============================================
// LIVE STATS (Real-time updates)
// ============================================
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

    const membership = await Membership.findOne({
      userId: req.session.userId,
      sessionId,
    });

    const isLecturerUser = session.lecturer.toString() === req.session.userId;

    if (!membership && !isLecturerUser) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    // Live stats
    const now = new Date();
    const oneMinuteAgo = new Date(now - 60 * 1000);
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

    const totalMessages = await Message.countDocuments({
      sessionId,
      isDeleted: false,
    });

    const messagesLastMinute = await Message.countDocuments({
      sessionId,
      isDeleted: false,
      timestamp: { $gte: oneMinuteAgo }
    });

    const messagesLast5Min = await Message.countDocuments({
      sessionId,
      isDeleted: false,
      timestamp: { $gte: fiveMinutesAgo }
    });

    const activeUsers = await Message.distinct('userId', {
      sessionId,
      isDeleted: false,
    });

    const totalMembers = await Membership.countDocuments({ sessionId });

    res.json({
      success: true,
      live: {
        totalMessages,
        messagesLastMinute,
        messagesLast5Min,
        messagesPerMinute: (messagesLast5Min / 5).toFixed(1),
        activeUsers: activeUsers.length,
        totalMembers,
        participationRate: totalMembers > 0 
          ? ((activeUsers.length / totalMembers) * 100).toFixed(1) 
          : 0,
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

// ============================================
// EXPORT CSV
// ============================================
router.get('/export-csv/:sessionId', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId } = req.params;

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

    const messages = await Message.find({
      sessionId,
      isDeleted: false,
    })
    .populate('userId', 'displayName email role')
    .sort({ timestamp: 1 });

    const totalMessages = messages.length;
    const activeUsers = [...new Set(messages.map(m => m.userId?._id?.toString()))].length;
    const totalMembers = await Membership.countDocuments({ sessionId });

    const typeCounts = { QUESTION: 0, COMMENT: 0, CONFUSION: 0 };
    messages.forEach(m => {
      if (typeCounts[m.type] !== undefined) typeCounts[m.type]++;
    });

    let csv = 'Session Analytics Export\n';
    csv += `Session Title,${session.title}\n`;
    csv += `Module Code,${session.moduleCode || 'N/A'}\n`;
    csv += `Join Code,${session.joinCode}\n`;
    csv += `Export Date,${new Date().toISOString()}\n\n`;

    csv += 'Summary Statistics\n';
    csv += `Total Messages,${totalMessages}\n`;
    csv += `Active Contributors,${activeUsers}\n`;
    csv += `Total Members,${totalMembers}\n`;
    csv += `Participation Rate,${totalMembers > 0 ? ((activeUsers / totalMembers) * 100).toFixed(1) : 0}%\n`;
    csv += `Questions,${typeCounts.QUESTION}\n`;
    csv += `Comments,${typeCounts.COMMENT}\n`;
    csv += `Confusion,${typeCounts.CONFUSION}\n\n`;

    csv += 'Message Log\n';
    csv += 'Timestamp,User,Role,Type,Identity Mode,Message\n';
    
    messages.forEach(msg => {
      const timestamp = new Date(msg.timestamp).toISOString();
      const user = msg.userId?.displayName || 'Unknown';
      const role = msg.userId?.role || 'student';
      const type = msg.type || 'COMMENT';
      const identityMode = msg.identityMode || 'identified';
      const text = `"${(msg.text || '').replace(/"/g, '""')}"`;
      
      csv += `${timestamp},${user},${role},${type},${identityMode},${text}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="session_${session.joinCode}_analytics.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error exporting CSV',
      error: error.message,
    });
  }
});

module.exports = router;