const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Membership = require('../models/Membership');
const Session = require('../models/Session');
const StudentReflection = require('../models/studentreflection');
const { isAuthenticated } = require('../middleware/auth');

router.get('/student/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId;

    const membership = await Membership.findOne({ userId, sessionId });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Not a member' });
    }

    const myMessages = await Message.find({
      sessionId,
      userId,
      isDeleted: false,
    }).sort({ timestamp: 1 });

    const myMessageCount = myMessages.length;

    const totalMembers = await Membership.countDocuments({ sessionId });
    const totalMessages = await Message.countDocuments({ sessionId, isDeleted: false });
    const classAverage = totalMembers > 0 ? (totalMessages / totalMembers).toFixed(1) : 0;

    const myTypeCounts = { QUESTION: 0, COMMENT: 0, CONFUSION: 0 };
    myMessages.forEach(m => {
      if (myTypeCounts[m.type] !== undefined) myTypeCounts[m.type]++;
    });

    const allParticipants = await Message.aggregate([
      { $match: { sessionId: membership.sessionId, isDeleted: false } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const myRank = allParticipants.findIndex(p => p._id.toString() === userId) + 1;
    const percentile = myRank && allParticipants.length > 0
      ? ((1 - (myRank - 1) / allParticipants.length) * 100).toFixed(1)
      : null;

    const session = await Session.findById(sessionId);
    const sessionStart = session?.startTime || new Date(Math.min(...myMessages.map(m => m.timestamp)));

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

    const reflection = await StudentReflection.findOne({ userId, sessionId });

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

router.post('/goal/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId;
    const { text, targetCount } = req.body;

    // Validate goal target
    const target = parseInt(targetCount);
    
    if (!target || target < 1 || target > 50) {
      return res.status(400).json({ 
        success: false, 
        message: 'Goal target must be between 1 and 50' 
      });
    }

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

router.get('/history', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;

    const memberships = await Membership.find({ userId })
      .populate('sessionId', 'title moduleCode createdAt status')
      .sort({ joinedAt: -1 })
      .limit(20);

    const history = await Promise.all(memberships.map(async (m) => {
      if (!m.sessionId) return null;

      const messageCount = await Message.countDocuments({
        sessionId: m.sessionId._id,
        userId,
        isDeleted: false,
      });

      const myTypeBreakdown = await Message.aggregate([
        { $match: { sessionId: m.sessionId._id, userId: m.userId, isDeleted: false } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]);
      const myTypes = { QUESTION: 0, COMMENT: 0, CONFUSION: 0 };
      myTypeBreakdown.forEach(item => {
        if (myTypes[item._id] !== undefined) myTypes[item._id] = item.count;
      });

      const totalMessages = await Message.countDocuments({
        sessionId: m.sessionId._id,
        isDeleted: false,
      });

      const totalMembers = await Membership.countDocuments({ sessionId: m.sessionId._id });
      const classAvg = totalMembers > 0 ? (totalMessages / totalMembers).toFixed(1) : 0;

      const allParticipants = await Message.aggregate([
        { $match: { sessionId: m.sessionId._id, isDeleted: false } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const myRank = allParticipants.findIndex(p => p._id.toString() === userId) + 1;

      const reflection = await StudentReflection.findOne({ userId, sessionId: m.sessionId._id });

      return {
        sessionId: m.sessionId._id,
        title: m.sessionId.title,
        moduleCode: m.sessionId.moduleCode,
        date: m.sessionId.createdAt,
        status: m.sessionId.status,
        myMessages: messageCount,
        myTypes: myTypes,
        rank: myRank || null,
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

router.get('/semester-trend', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;

    const memberships = await Membership.find({ userId })
      .populate('sessionId', 'title moduleCode createdAt status')
      .sort({ joinedAt: 1 });

    const trend = await Promise.all(memberships.map(async (m) => {
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

      return {
        sessionTitle: m.sessionId.title,
        date: m.sessionId.createdAt,
        myMessages: messageCount,
        classAverage: parseFloat(classAvg),
      };
    }));

    res.json({
      success: true,
      trend: trend.filter(t => t !== null),
    });
  } catch (error) {
    console.error('Semester trend error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;