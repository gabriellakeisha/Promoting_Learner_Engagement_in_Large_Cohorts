const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Membership = require('../models/Membership');
const Session = require('../models/Session');
const StudentReflection = require('../models/studentreflection');
const { isAuthenticated } = require('../middleware/auth');

// Get enhanced student analytics with timeline
router.get('/student/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId;

    const membership = await Membership.findOne({ userId, sessionId });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }

    // 1. Personal stats
    const myMessages = await Message.find({
      sessionId,
      userId,
      isDeleted: false,
    }).sort({ timestamp: 1 });

    const myMessageCount = myMessages.length;

    // 2. Class stats
    const totalMembers = await Membership.countDocuments({ sessionId });
    const totalMessages = await Message.countDocuments({ sessionId, isDeleted: false });
    const classAverage = totalMembers > 0 ? (totalMessages / totalMembers).toFixed(1) : 0;

    // 3. Messages by type
    const myTypeCounts = { QUESTION: 0, COMMENT: 0, CONFUSION: 0 };
    myMessages.forEach(m => {
      if (myTypeCounts[m.type] !== undefined) myTypeCounts[m.type]++;
    });

    // 4. Participation rank
    const allParticipants = await Message.aggregate([
      { $match: { sessionId: membership.sessionId, isDeleted: false } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const myRank = allParticipants.findIndex(p => p._id.toString() === userId) + 1;
    const percentile = myRank && allParticipants.length > 0
      ? ((1 - (myRank - 1) / allParticipants.length) * 100).toFixed(1)
      : null;

    // 5. Participation timeline (5-minute buckets)
    const session = await Session.findById(sessionId);
    const sessionStart = session?.createdAt || new Date(Math.min(...myMessages.map(m => m.timestamp)));
    
    const timelineBuckets = {};
    myMessages.forEach(msg => {
      const minutesSinceStart = Math.floor((new Date(msg.timestamp) - new Date(sessionStart)) / (5 * 60 * 1000));
      const bucketKey = minutesSinceStart * 5;
      if (!timelineBuckets[bucketKey]) {
        timelineBuckets[bucketKey] = { time: `${bucketKey}min`, count: 0, types: { QUESTION: 0, COMMENT: 0, CONFUSION: 0 } };
      }
      timelineBuckets[bucketKey].count++;
      if (timelineBuckets[bucketKey].types[msg.type] !== undefined) {
        timelineBuckets[bucketKey].types[msg.type]++;
      }
    });

    const timeline = Object.values(timelineBuckets).sort((a, b) => 
      parseInt(a.time) - parseInt(b.time)
    );

    // 6. Get saved goal/reflection
    const reflection = await StudentReflection.findOne({ userId, sessionId });

    // 7. Goal progress calculation
    let goalProgress = null;
    if (reflection?.goal?.targetCount > 0) {
      const achieved = myTypeCounts.QUESTION;
      goalProgress = {
        target: reflection.goal.targetCount,
        achieved: achieved,
        completed: achieved >= reflection.goal.targetCount,
        percentage: Math.min(100, Math.round((achieved / reflection.goal.targetCount) * 100)),
      };
    }

    res.json({
      success: true,
      analytics: {
        personal: {
          messageCount: myMessageCount,
          messagesByType: myTypeCounts,
          rank: myRank || null,
          percentile: parseFloat(percentile) || null,
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
        timeline,
        goal: reflection?.goal || null,
        goalProgress,
        reflection: reflection?.reflection || null,
      },
    });
  } catch (error) {
    console.error('Student analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Save session goal
router.post('/goal/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId;
    const { text, targetCount } = req.body;

    const membership = await Membership.findOne({ userId, sessionId });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }

    let reflection = await StudentReflection.findOne({ userId, sessionId });
    
    if (!reflection) {
      reflection = new StudentReflection({ userId, sessionId });
    }

    reflection.goal = {
      text: text || `Ask ${targetCount} questions`,
      targetCount: targetCount || 2,
      achievedCount: 0,
      createdAt: new Date(),
    };
    reflection.updatedAt = new Date();

    await reflection.save();

    res.json({ success: true, goal: reflection.goal });
  } catch (error) {
    console.error('Save goal error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Save reflection
router.post('/reflection/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId;
    const { understanding, confusingTopic, improvement } = req.body;

    const membership = await Membership.findOne({ userId, sessionId });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }

    let reflectionDoc = await StudentReflection.findOne({ userId, sessionId });
    
    if (!reflectionDoc) {
      reflectionDoc = new StudentReflection({ userId, sessionId });
    }

    reflectionDoc.reflection = {
      understanding: understanding || 3,
      confusingTopic: confusingTopic || '',
      improvement: improvement || '',
      submittedAt: new Date(),
    };
    reflectionDoc.updatedAt = new Date();

    await reflectionDoc.save();

    res.json({ success: true, reflection: reflectionDoc.reflection });
  } catch (error) {
    console.error('Save reflection error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get session history (all sessions for this user)
router.get('/history', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;

    const memberships = await Membership.find({ userId })
      .populate('sessionId', 'title moduleCode createdAt status')
      .sort({ joinedAt: -1 })
      .limit(10);

    const history = await Promise.all(memberships.map(async (m) => {
      if (!m.sessionId) return null;

      const messageCount = await Message.countDocuments({
        sessionId: m.sessionId._id,
        userId,
        isDeleted: false,
      });

      const totalMessages = await Message.countDocuments({
        sessionId: m.sessionId._id,
        isDeleted: false,
      });

      const totalMembers = await Membership.countDocuments({ sessionId: m.sessionId._id });
      const classAvg = totalMembers > 0 ? (totalMessages / totalMembers).toFixed(1) : 0;

      const reflection = await StudentReflection.findOne({ userId, sessionId: m.sessionId._id });

      return {
        sessionId: m.sessionId._id,
        title: m.sessionId.title,
        moduleCode: m.sessionId.moduleCode,
        date: m.sessionId.createdAt,
        status: m.sessionId.status,
        myMessages: messageCount,
        classAverage: parseFloat(classAvg),
        aboveAverage: messageCount > parseFloat(classAvg),
        understanding: reflection?.reflection?.understanding || null,
      };
    }));

    res.json({
      success: true,
      history: history.filter(h => h !== null),
    });
  } catch (error) {
    console.error('Session history error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;