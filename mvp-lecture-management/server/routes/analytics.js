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
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.lecturer.toString() !== req.session.userId) return res.status(403).json({ success: false, message: 'Access denied.' });

    const totalMessages = await Message.countDocuments({ sessionId, isDeleted: false });

    const messagesByType = await Message.aggregate([
      { $match: { sessionId: session._id, isDeleted: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const typeCounts = { QUESTION: 0, COMMENT: 0, CONFUSION: 0 };
    messagesByType.forEach(item => { typeCounts[item._id] = item.count; });

    const activeUserIds = await Message.distinct('userId', { sessionId, isDeleted: false });
    const activeUserCount = activeUserIds.length;
    const totalMembers = await Membership.countDocuments({ sessionId });
    const consumersCount = Math.max(0, totalMembers - activeUserCount);
    const participationRate = totalMembers > 0 ? Math.min(100, ((activeUserCount / totalMembers) * 100)).toFixed(1) : 0;

    const engagementTimeline = await Message.aggregate([
      { $match: { sessionId: session._id, isDeleted: false } },
      {
        $group: {
          _id: {
            $toDate: {
              $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, 300000] }]
            }
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const timeline = engagementTimeline.map(t => ({
      time: new Date(t._id).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      fullTime: t._id,
      count: t.count,
    }));

    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
    const messagesLast5Min = await Message.countDocuments({ sessionId, isDeleted: false, timestamp: { $gte: fiveMinutesAgo } });
    const messagesLast10Min = await Message.countDocuments({ sessionId, isDeleted: false, timestamp: { $gte: tenMinutesAgo } });
    const messagesPerMinute = (messagesLast5Min / 5).toFixed(1);

    const confusionLast3Min = await Message.countDocuments({
      sessionId, isDeleted: false, type: 'CONFUSION',
      timestamp: { $gte: new Date(now - 3 * 60 * 1000) }
    });
    const confusionSpikeActive = confusionLast3Min >= 3;
    const confusionPerMinute = (confusionLast3Min / 3).toFixed(1);

    const topContributors = await Message.aggregate([
      { $match: { sessionId: session._id, isDeleted: false } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: { 'user.role': { $ne: 'lecturer' } } },
      { $group: { _id: '$userId', messageCount: { $sum: 1 } } },
      { $sort: { messageCount: -1 } },
      { $limit: 5 },
    ]);
    const topContributorsWithNames = await Promise.all(
      topContributors.map(async (c) => {
        const user = await User.findById(c._id).select('displayName email');
        return { userId: c._id, displayName: user?.displayName || 'Anonymous', email: user?.email || 'N/A', messageCount: c.messageCount };
      })
    );

    const identityModeBreakdown = await Message.aggregate([
      { $match: { sessionId: session._id, isDeleted: false } },
      { $group: { _id: { $ifNull: ['$identityMode', 'identified'] }, count: { $sum: 1 } } },
    ]);
    const identityModes = { anonymous: 0, pseudonymous: 0, identified: 0 };
    identityModeBreakdown.forEach(item => { identityModes[item._id] = item.count; });

    const allMessages = await Message.find({ sessionId, isDeleted: false }).select('text');
    const stopWords = new Set([
      'the','a','an','is','are','was','were','be','been','being','have','has','had',
      'do','does','did','will','would','could','should','may','might','must','shall',
      'can','need','dare','ought','used','to','of','in','for','on','with','at','by',
      'from','as','into','through','during','before','after','above','below','between',
      'under','again','further','then','once','here','there','when','where','why','how',
      'all','each','few','more','most','other','some','such','no','nor','not','only',
      'own','same','so','than','too','very','just','and','but','if','or','because',
      'until','while','this','that','these','those','what','which','who','whom','i',
      'me','my','we','our','you','your','he','him','his','she','her','it','its',
      'they','them','their','am','get','got','also','like','know','think','dont',
      "don't",'im',"i'm",'about','yes','yeah','ok','okay'
    ]);
    const wordCounts = {};
    allMessages.forEach(msg => {
      if (!msg.text) return;
      const words = msg.text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
      words.forEach(word => { wordCounts[word] = (wordCounts[word] || 0) + 1; });
    });
    const keywords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([word, count]) => ({ word, count }));

    const peakActivity = timeline.reduce((max, current) => current.count > (max?.count || 0) ? current : max, null);
    const confusionRate = totalMessages > 0 ? ((typeCounts.CONFUSION / totalMessages) * 100).toFixed(1) : 0;
    const questionRate = totalMessages > 0 ? ((typeCounts.QUESTION / totalMessages) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      analytics: {
        summary: {
          totalMessages, activeUsers: activeUserCount, totalMembers, consumersCount,
          participationRate: parseFloat(participationRate),
          messagesPerMinute: parseFloat(messagesPerMinute),
          messagesLast5Min, messagesLast10Min,
        },
        messagesByType: typeCounts,
        confusionRate: parseFloat(confusionRate),
        questionRate: parseFloat(questionRate),
        confusionSpike: {
          active: confusionSpikeActive,
          confusionLast3Min: confusionLast3Min,
          confusionPerMinute: parseFloat(confusionPerMinute),
        },
        identityModes, timeline, peakActivity,
        topContributors: topContributorsWithNames, keywords,
      },
    });
  } catch (error) {
    console.error('Lecturer analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching analytics', error: error.message });
  }
});

router.get('/export/:sessionId', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.lecturer.toString() !== req.session.userId) return res.status(403).json({ success: false, message: 'Access denied' });

    const messages = await Message.find({ sessionId, isDeleted: false })
      .populate('userId', 'displayName email role').sort({ timestamp: 1 });

    const totalMessages = messages.length;
    const activeUsers = [...new Set(messages.map(m => m.userId?._id?.toString()))].length;
    const totalMembers = await Membership.countDocuments({ sessionId });

    const typeCounts = { QUESTION: 0, COMMENT: 0, CONFUSION: 0 };
    messages.forEach(m => { if (typeCounts[m.type] !== undefined) typeCounts[m.type]++; });

    let csv = 'Session Analytics Export\n';
    csv += `Session Title,${session.title}\n`;
    csv += `Module Code,${session.moduleCode || 'N/A'}\n`;
    csv += `Join Code,${session.joinCode}\n`;
    csv += `Export Date,${new Date().toISOString()}\n\n`;
    csv += 'Summary Statistics\n';
    csv += `Total Messages,${totalMessages}\n`;
    csv += `Active Contributors,${activeUsers}\n`;
    csv += `Total Members,${totalMembers}\n`;
    csv += `Participation Rate,${totalMembers > 0 ? Math.min(100, ((activeUsers / totalMembers) * 100)).toFixed(1) : 0}%\n`;
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
    res.status(500).json({ success: false, message: 'Server error exporting CSV', error: error.message });
  }
});

router.get('/student/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const membership = await Membership.findOne({ userId: req.session.userId, sessionId });
    if (!membership) return res.status(403).json({ success: false, message: 'You are not a member of this session' });

    const myMessageCount = await Message.countDocuments({ sessionId, userId: req.session.userId, isDeleted: false });
    const totalMembers = await Membership.countDocuments({ sessionId });
    const totalMessages = await Message.countDocuments({ sessionId, isDeleted: false });
    const classAverage = totalMembers > 0 ? (totalMessages / totalMembers).toFixed(1) : 0;

    const myMessagesByType = await Message.aggregate([
      { $match: { sessionId: membership.sessionId, userId: membership.userId, isDeleted: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const myTypeCounts = { QUESTION: 0, COMMENT: 0, CONFUSION: 0 };
    myMessagesByType.forEach(item => { myTypeCounts[item._id] = item.count; });

    const allParticipants = await Message.aggregate([
      { $match: { sessionId: membership.sessionId, isDeleted: false } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const myRank = allParticipants.findIndex(p => p._id.toString() === req.session.userId) + 1;

    res.json({
      success: true,
      analytics: {
        personal: {
          messageCount: myMessageCount, messagesByType: myTypeCounts, rank: myRank || null,
          percentile: myRank && allParticipants.length > 0 ?
            ((1 - myRank / allParticipants.length) * 100).toFixed(0) : null,
        },
        class: { average: parseFloat(classAverage), totalMessages, totalMembers, activeMembers: allParticipants.length },
        comparison: {
          aboveAverage: myMessageCount > parseFloat(classAverage),
          difference: (myMessageCount - parseFloat(classAverage)).toFixed(1),
        },
      },
    });
  } catch (error) {
    console.error('Student analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/macro', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const lecturerId = req.session.userId;
    const moduleFilter = req.query.module || null;
    const dateFrom = req.query.from || null;
    const dateTo = req.query.to || null;

    const lecturerSessions = await Session.find({ lecturer: lecturerId }).sort({ createdAt: 1 });
    if (!lecturerSessions || lecturerSessions.length === 0) {
      return res.json({ success: true, sessions: [], modules: [], confusionTopics: [], identityTrends: [] });
    }

    const modules = [...new Set(lecturerSessions.map(s => s.moduleCode).filter(Boolean))];
    let filteredSessions = moduleFilter
      ? lecturerSessions.filter(s => s.moduleCode === moduleFilter)
      : lecturerSessions;

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredSessions = filteredSessions.filter(s => new Date(s.createdAt) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filteredSessions = filteredSessions.filter(s => new Date(s.createdAt) <= toDate);
    }

    const stopWords = new Set([
      'the','a','an','is','are','was','were','be','been','being','have','has','had',
      'do','does','did','will','would','could','should','may','might','must','shall',
      'can','need','dare','ought','used','to','of','in','for','on','with','at','by',
      'from','as','into','through','during','before','after','above','below','between',
      'under','again','further','then','once','here','there','when','where','why','how',
      'all','each','few','more','most','other','some','such','no','nor','not','only',
      'own','same','so','than','too','very','just','and','but','if','or','because',
      'until','while','this','that','these','those','what','which','who','whom','i',
      'me','my','we','our','you','your','he','him','his','she','her','it','its',
      'they','them','their','am','get','got','also','like','know','think','dont',
      "don't",'im',"i'm",'about','yes','yeah','ok','okay','really','much','thing',
      'things','something','anything','everything','nothing','way','well','still',
      'even','back','going','come','make','made','take','want','see','look','find'
    ]);

    const confusionTopicMap = {};
    const identityTrends = [];

    const sessionAnalytics = await Promise.all(
      filteredSessions.map(async (session) => {
        const sessionId = session._id;
        const totalMessages = await Message.countDocuments({ sessionId, isDeleted: false });

        const messagesByType = await Message.aggregate([
          { $match: { sessionId: session._id, isDeleted: false } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]);
        const typeCounts = { QUESTION: 0, COMMENT: 0, CONFUSION: 0 };
        messagesByType.forEach(item => {
          if (typeCounts[item._id] !== undefined) typeCounts[item._id] = item.count;
        });

        const activeUserIds = await Message.distinct('userId', { sessionId, isDeleted: false });
        const totalMembers = await Membership.countDocuments({ sessionId });
        const participationRate = totalMembers > 0 ? Math.min(100, ((activeUserIds.length / totalMembers) * 100)).toFixed(1) : '0.0';
        const confusionRate = totalMessages > 0 ? ((typeCounts.CONFUSION / totalMessages) * 100).toFixed(1) : '0.0';
        const questionRate = totalMessages > 0 ? ((typeCounts.QUESTION / totalMessages) * 100).toFixed(1) : '0.0';

        const confusionMessages = await Message.find({
          sessionId, isDeleted: false, type: 'CONFUSION'
        }).select('text');

        confusionMessages.forEach(msg => {
          if (!msg.text) return;
          const words = msg.text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
          words.forEach(word => {
            if (!confusionTopicMap[word]) {
              confusionTopicMap[word] = { word: word, count: 0, sessions: new Set() };
            }
            confusionTopicMap[word].count++;
            confusionTopicMap[word].sessions.add(session.title);
          });
        });

        const identityBreakdown = await Message.aggregate([
          { $match: { sessionId: session._id, isDeleted: false } },
          { $group: { _id: { $ifNull: ['$identityMode', 'identified'] }, count: { $sum: 1 } } },
        ]);
        const modes = { anonymous: 0, pseudonymous: 0, identified: 0 };
        identityBreakdown.forEach(item => { modes[item._id] = item.count; });

        identityTrends.push({
          sessionTitle: session.title,
          date: session.createdAt,
          anonymous: modes.anonymous,
          pseudonymous: modes.pseudonymous,
          identified: modes.identified,
          total: totalMessages,
        });

        return {
          sessionId: session._id, title: session.title, moduleCode: session.moduleCode || '',
          date: session.createdAt, status: session.status, totalMessages,
          questions: typeCounts.QUESTION, comments: typeCounts.COMMENT, confusion: typeCounts.CONFUSION,
          activeUsers: activeUserIds.length, totalMembers, participationRate, confusionRate, questionRate,
        };
      })
    );

    const confusionTopics = Object.values(confusionTopicMap)
      .map(t => ({ word: t.word, count: t.count, sessionCount: t.sessions.size, sessions: [...t.sessions] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    res.json({
      success: true,
      sessions: sessionAnalytics,
      modules: modules,
      totalSessions: sessionAnalytics.length,
      confusionTopics: confusionTopics,
      identityTrends: identityTrends,
    });
  } catch (error) {
    console.error('Macro analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load cross-session analytics', error: error.message });
  }
});

router.get('/ai-summary/:sessionId', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const messages = await Message.find({ sessionId, isDeleted: false })
      .populate('userId', 'displayName role')
      .sort({ timestamp: 1 });

    const totalMembers = await Membership.countDocuments({ sessionId });

    if (messages.length === 0) {
      return res.json({
        success: true,
        summary: {
          overview: 'No messages recorded in this session. The summary will be available once students begin participating.',
          sections: []
        }
      });
    }

    var totalMessages = messages.length;
    var uniqueContributors = [...new Set(messages.map(m => m.userId?._id?.toString()).filter(Boolean))].length;
    var participationRate = totalMembers > 0 ? ((uniqueContributors / totalMembers) * 100).toFixed(1) : 0;

    var typeCounts = { QUESTION: 0, COMMENT: 0, CONFUSION: 0, NONE: 0 };
    messages.forEach(function(m) {
      if (typeCounts[m.type] !== undefined) typeCounts[m.type]++;
      else typeCounts.NONE++;
    });

    var identityCounts = { anonymous: 0, pseudonymous: 0, identified: 0 };
    messages.forEach(function(m) {
      var mode = m.identityMode || 'identified';
      if (identityCounts[mode] !== undefined) identityCounts[mode]++;
    });

    var sessionStart = messages[0].timestamp;
    var sessionEnd = messages[messages.length - 1].timestamp;
    var durationMs = new Date(sessionEnd) - new Date(sessionStart);
    var durationMin = Math.max(1, Math.round(durationMs / 60000));

    var bucketSize = 5;
    var maxSessionMinutes = 180;
    var buckets = {};
    messages.forEach(function(msg) {
      var min = Math.floor((new Date(msg.timestamp) - new Date(sessionStart)) / 60000);
      if (min < 0 || min > maxSessionMinutes) return;
      var bucketKey = Math.floor(min / bucketSize) * bucketSize;
      if (!buckets[bucketKey]) buckets[bucketKey] = 0;
      buckets[bucketKey]++;
    });

    var coreMessages = messages.filter(function(m) {
      var min = Math.floor((new Date(m.timestamp) - new Date(sessionStart)) / 60000);
      return min >= 0 && min <= maxSessionMinutes;
    });
    var coreDurationMs = coreMessages.length > 1 ? (new Date(coreMessages[coreMessages.length - 1].timestamp) - new Date(coreMessages[0].timestamp)) : durationMs;
    var coreDurationMin = Math.max(1, Math.round(coreDurationMs / 60000));
    durationMin = coreDurationMin;

    var peakBucket = null;
    var peakCount = 0;
    var quietBucket = null;
    var quietCount = Infinity;
    Object.keys(buckets).forEach(function(k) {
      if (buckets[k] > peakCount) { peakCount = buckets[k]; peakBucket = parseInt(k); }
      if (buckets[k] < quietCount) { quietCount = buckets[k]; quietBucket = parseInt(k); }
    });

    var firstHalfMsgs = coreMessages.filter(function(m) {
      return (new Date(m.timestamp) - new Date(sessionStart)) < coreDurationMs / 2;
    }).length;
    var secondHalfMsgs = coreMessages.length - firstHalfMsgs;

    var engagementTrend = 'steady';
    if (secondHalfMsgs > firstHalfMsgs * 1.4) engagementTrend = 'increasing';
    else if (firstHalfMsgs > secondHalfMsgs * 1.4) engagementTrend = 'decreasing';

    var stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','shall','should','may','might','must','can','could','i','me','my','we','our','you','your','he','him','his','she','her','it','its','they','them','their','this','that','these','those','what','which','who','whom','how','when','where','why','am','not','no','yes','so','if','or','and','but','for','nor','on','at','to','from','by','up','about','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','all','each','every','both','few','more','most','other','some','such','only','own','same','than','too','very','just','because','as','until','while','of','with','in','also','im','dont','cant','thats','its','ive','like','get','got','really','think','know','going','want','need','one','much','well','even','still','thing','right','back','way','make','say','said','see','go','come','take','give','tell','ask','try','use','find','let','put','keep','work','look','thanks','thank','good','great','nice','okay','ok','yeah','yep','sure','agree','lol','haha','wow','cool','interesting','helpful','clear','clearer','clarification','clarify','explanation','explain','example','similar','found','slides','textbook','lecture','class','professor','question','comment','please','sorry','maybe','actually','basically','definitely','probably','exactly','pretty','quite','anyway','though','seems','feel','lot','bit','now']);

    var preserveTerms = {};
    messages.forEach(function(m) {
      if (!m.text) return;
      var matches = m.text.match(/[A-Z]{2,}(?:\/[A-Z]{2,})+/g);
      if (matches) {
        matches.forEach(function(term) {
          var key = term.toLowerCase().replace(/\//g, '');
          preserveTerms[key] = term;
        });
      }
    });

    var wordCounts = {};
    messages.forEach(function(m) {
      if (!m.text) return;
      var words = m.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
      words.forEach(function(w) {
        if (w.length > 2 && !stopWords.has(w)) {
          wordCounts[w] = (wordCounts[w] || 0) + 1;
        }
      });
    });
    var topKeywords = Object.entries(wordCounts)
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, 10)
      .map(function(e) { return preserveTerms[e[0]] || e[0]; });

    var confusionMessages = messages.filter(function(m) { return m.type === 'CONFUSION'; });
    var confusionKeywords = {};
    confusionMessages.forEach(function(m) {
      if (!m.text) return;
      var words = m.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
      words.forEach(function(w) {
        if (w.length > 2 && !stopWords.has(w)) {
          confusionKeywords[w] = (confusionKeywords[w] || 0) + 1;
        }
      });
    });
    var topConfusionTopics = Object.entries(confusionKeywords)
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, 5)
      .map(function(e) { return preserveTerms[e[0]] || e[0]; });

    var questionMessages = messages.filter(function(m) { return m.type === 'QUESTION'; });
    var questionSamples = questionMessages.slice(0, 5).map(function(m) { return m.text.substring(0, 120); });

    var dominantIdentity = 'identified';
    if (identityCounts.anonymous >= identityCounts.pseudonymous && identityCounts.anonymous >= identityCounts.identified) dominantIdentity = 'anonymous';
    else if (identityCounts.pseudonymous >= identityCounts.anonymous && identityCounts.pseudonymous >= identityCounts.identified) dominantIdentity = 'pseudonymous';

    var sections = [];

    var participationLevel = parseFloat(participationRate) >= 70 ? 'high' : (parseFloat(participationRate) >= 40 ? 'moderate' : 'low');
    var overviewText = 'Session "' + session.title + '" lasted approximately ' + durationMin + ' minutes with ' + totalMessages + ' messages from ' + uniqueContributors + ' of ' + totalMembers + ' enrolled students (' + participationRate + '% participation rate). ';
    overviewText += 'This represents ' + participationLevel + ' engagement. ';
    overviewText += 'The messaging rate averaged ' + (totalMessages / durationMin).toFixed(1) + ' messages per minute.';

    sections.push({
      title: 'Engagement Pattern',
      content: 'Engagement was ' + engagementTrend + ' over the session. ' +
        'Peak activity occurred at the ' + peakBucket + '-' + (peakBucket + bucketSize) + ' minute mark (' + peakCount + ' messages). ' +
        (quietBucket !== null && quietBucket !== peakBucket ? 'The quietest period was at ' + quietBucket + '-' + (quietBucket + bucketSize) + ' minutes (' + quietCount + ' messages). ' : '') +
        (engagementTrend === 'decreasing' ? 'Engagement dropped in the second half, which may indicate content difficulty increased or attention waned. Consider adding interactive elements (polls, breakout questions) during the latter portion.' : '') +
        (engagementTrend === 'increasing' ? 'Students became more engaged as the session progressed, suggesting the topic generated growing interest or that students became more comfortable participating.' : '') +
        (engagementTrend === 'steady' ? 'Engagement remained consistent throughout, indicating a well-paced session.' : '')
    });

    sections.push({
      title: 'Message Classification Breakdown',
      content: 'Questions: ' + typeCounts.QUESTION + ' (' + (totalMessages > 0 ? (typeCounts.QUESTION / totalMessages * 100).toFixed(0) : 0) + '%), ' +
        'Comments: ' + typeCounts.COMMENT + ' (' + (totalMessages > 0 ? (typeCounts.COMMENT / totalMessages * 100).toFixed(0) : 0) + '%), ' +
        'Confusion signals: ' + typeCounts.CONFUSION + ' (' + (totalMessages > 0 ? (typeCounts.CONFUSION / totalMessages * 100).toFixed(0) : 0) + '%)' +
        (typeCounts.NONE > 0 ? ', Unclassified: ' + typeCounts.NONE + ' (' + (totalMessages > 0 ? (typeCounts.NONE / totalMessages * 100).toFixed(0) : 0) + '%)' : '') + '. ' +
        (typeCounts.CONFUSION > typeCounts.QUESTION ? 'Confusion signals exceeded questions, suggesting students struggled to articulate their difficulties. Consider proactively addressing common confusion areas.' : '') +
        (typeCounts.QUESTION > totalMessages * 0.4 ? 'A high proportion of questions indicates active inquiry-based learning.' : '')
    });

    if (topConfusionTopics.length > 0) {
      sections.push({
        title: 'Areas of Confusion',
        content: 'The most frequent terms in confusion-flagged messages were: ' + topConfusionTopics.join(', ') + '. ' +
          'These topics may benefit from additional explanation, worked examples, or supplementary materials in follow-up sessions.'
      });
    }

    if (questionSamples.length > 0) {
      sections.push({
        title: 'Key Questions Raised',
        content: 'Students asked ' + typeCounts.QUESTION + ' questions during the session. Representative examples include: "' +
          questionSamples.join('", "') + '". ' +
          (typeCounts.QUESTION > 3 ? 'The volume of questions suggests areas where students sought clarification or deeper understanding.' : '')
      });
    }

    if (topKeywords.length > 0) {
      sections.push({
        title: 'Discussion Topics',
        content: 'The most frequently discussed terms were: ' + topKeywords.join(', ') + '. ' +
          'These keywords reflect the primary focus areas of student discussion during the session.'
      });
    }

    sections.push({
      title: 'Identity Mode Usage',
      content: 'Students used: anonymous (' + identityCounts.anonymous + ' messages), pseudonymous/alias (' + identityCounts.pseudonymous + ' messages), and identified/real name (' + identityCounts.identified + ' messages). ' +
        'The dominant mode was ' + dominantIdentity + '. ' +
        (dominantIdentity === 'anonymous' ? 'High anonymous usage suggests students prefer privacy when participating, which is common in larger cohorts where students may feel self-conscious.' : '') +
        (dominantIdentity === 'identified' ? 'Students were comfortable using their real identities, indicating a trusting classroom environment.' : '') +
        (dominantIdentity === 'pseudonymous' ? 'Alias usage balances participation comfort with some sense of identity continuity across messages.' : '')
    });

    var recommendations = [];
    if (parseFloat(participationRate) < 40) recommendations.push('Participation was below 40%. Consider using polls or direct prompts to encourage more students to engage.');
    if (engagementTrend === 'decreasing') recommendations.push('Engagement declined over the session. Try scheduling interactive activities in the second half to maintain attention.');
    if (typeCounts.CONFUSION > totalMessages * 0.2) recommendations.push('Over 20% of messages were confusion signals. Review the flagged topics and consider revisiting them in the next session.');
    if (uniqueContributors < totalMembers * 0.3) recommendations.push('Less than 30% of enrolled students contributed. The lurker ratio is high. Anonymous mode or simpler participation methods (reactions, polls) may help.');
    if (typeCounts.QUESTION === 0) recommendations.push('No questions were recorded. Encourage students to use the question tag to flag things they want clarified.');

    if (recommendations.length > 0) {
      sections.push({
        title: 'Recommendations',
        content: recommendations.join(' ')
      });
    }

    res.json({
      success: true,
      summary: {
        overview: overviewText,
        sessionTitle: session.title,
        moduleCode: session.moduleCode,
        generatedAt: new Date().toISOString(),
        stats: {
          totalMessages: totalMessages,
          uniqueContributors: uniqueContributors,
          totalMembers: totalMembers,
          participationRate: participationRate,
          durationMinutes: durationMin,
          messagesPerMinute: (totalMessages / durationMin).toFixed(1)
        },
        sections: sections
      }
    });
  } catch (error) {
    console.error('Generate summary error:', error);
    res.status(500).json({ success: false, message: 'Server error generating summary', error: error.message });
  }
});

module.exports = router;