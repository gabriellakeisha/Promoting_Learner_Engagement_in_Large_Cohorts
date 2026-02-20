const express = require('express');
const User = require('../models/User');
const router = express.Router();
const Session = require('../models/Session');
const Membership = require('../models/Membership');
const { isAuthenticated, isLecturer } = require('../middleware/auth');

// Create new session (lecturer only)
router.post('/create', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { title, moduleCode, description } = req.body;

    // Validation
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Session title is required',
      });
    }

    // Generate unique join code
    let joinCode;
    let isUnique = false;
    
    while (!isUnique) {
      joinCode = Session.generateJoinCode();
      const existing = await Session.findOne({ joinCode });
      if (!existing) isUnique = true;
    }

    // Create session
    const { isScheduled, scheduledStart, scheduledEnd } = req.body;

    let status = 'active';
    let startTime = new Date();
    let endTime = null;

    if (isScheduled && scheduledStart) {
      status = 'scheduled';
      startTime = new Date(scheduledStart);
      endTime = scheduledEnd ? new Date(scheduledEnd) : null;
    }

    const session = new Session({
      title,
      joinCode,
      lecturer: req.session.userId,
      moduleCode: moduleCode || '',
      description: description || '',
      status: status,
      startTime: startTime,
      endTime: endTime,
    });

    await session.save();

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      session: {
        id: session._id,
        title: session.title,
        joinCode: session.joinCode,
        moduleCode: session.moduleCode,
        description: session.description,
        status: session.status,
        startTime: session.startTime,
      },
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating session',
      error: error.message,
    });
  }
});

// Join session by code (student)
router.post('/join', isAuthenticated, async (req, res) => {
  try {
    const { joinCode } = req.body;

    // Validation
    if (!joinCode) {
      return res.status(400).json({
        success: false,
        message: 'Join code is required',
      });
    }

    // Find session
    const session = await Session.findOne({ 
      joinCode: joinCode.toUpperCase(),
      status: { $in: ['active', 'scheduled'] },
    }).populate('lecturer', 'displayName email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or has ended',
      });
    }

    // Check if already a member
    const existingMembership = await Membership.findOne({
      userId: req.session.userId,
      sessionId: session._id,
    });

    if (existingMembership) {
      return res.json({
        success: true,
        message: 'Already a member of this session',
        session: {
          id: session._id,
          title: session.title,
          joinCode: session.joinCode,
          moduleCode: session.moduleCode,
          lecturer: session.lecturer.displayName,
          startTime: session.startTime,
        },
      });
    }

    // Create membership
    const membership = new Membership({
      userId: req.session.userId,
      sessionId: session._id,
    });

    await membership.save();

    res.json({
      success: true,
      message: 'Successfully joined session',
      session: {
        id: session._id,
        title: session.title,
        joinCode: session.joinCode,
        moduleCode: session.moduleCode,
        description: session.description,
        lecturer: session.lecturer.displayName,
        startTime: session.startTime,
      },
    });
  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error joining session',
      error: error.message,
    });
  }
});

// Get all sessions for current user
router.get('/my-sessions', isAuthenticated, async (req, res) => {
  try {
    let sessions;

    if (req.session.userRole === 'lecturer') {
      // Lecturers see sessions they created
      sessions = await Session.find({ lecturer: req.session.userId })
        .sort({ createdAt: -1 });
    } else {
      // Students see sessions they joined
      const memberships = await Membership.find({ userId: req.session.userId })
        .populate({
          path: 'sessionId',
          populate: { path: 'lecturer', select: 'displayName email' },
        });

      sessions = memberships
        .filter(m => m.sessionId) // Filter out null sessions
        .map(m => m.sessionId);
    }

    res.json({
      success: true,
      sessions: sessions.map(s => ({
        id: s._id,
        title: s.title,
        joinCode: s.joinCode,
        moduleCode: s.moduleCode,
        description: s.description,
        status: s.status,
        startTime: s.startTime,
        endTime: s.endTime,
        lecturer: s.lecturer?.displayName || 'Unknown',
      })),
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching sessions',
      error: error.message,
    });
  }
});

// Get single session details
router.get('/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId)
      .populate('lecturer', 'displayName email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Check if user has access
    const isMember = await Membership.findOne({
      userId: req.session.userId,
      sessionId: session._id,
    });

    const isOwner = session.lecturer._id.toString() === req.session.userId;

    if (!isMember && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this session.',
      });
    }

    // Get member count
    const memberCount = await Membership.countDocuments({ sessionId: session._id });

    res.json({
      success: true,
      session: {
        id: session._id,
        title: session.title,
        joinCode: session.joinCode,
        moduleCode: session.moduleCode,
        description: session.description,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        lecturer: {
          id: session.lecturer._id,
          name: session.lecturer.displayName,
          email: session.lecturer.email,
        },
        memberCount,
        isOwner,
      },
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching session',
      error: error.message,
    });
  }
});

router.post('/:sessionId/activate', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.lecturer.toString() !== req.session.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (session.status !== 'scheduled') {
      return res.status(400).json({ success: false, message: 'Only scheduled sessions can be activated' });
    }

    session.status = 'active';
    session.startTime = new Date();
    await session.save();

    res.json({
      success: true,
      message: 'Session activated',
      session: {
        id: session._id,
        status: session.status,
        startTime: session.startTime,
      },
    });
  } catch (error) {
    console.error('Activate session error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// End session
router.post('/:sessionId/end', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Check ownership
    if (session.lecturer.toString() !== req.session.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not the owner of this session.',
      });
    }

    await session.endSession();

    res.json({
      success: true,
      message: 'Session ended successfully',
      session: {
        id: session._id,
        status: session.status,
        endTime: session.endTime,
      },
    });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error ending session',
      error: error.message,
    });
  }
});

// Get session members (lecturer only)
router.get('/:sessionId/members', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Check ownership
    if (session.lecturer.toString() !== req.session.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    const memberships = await Membership.find({ sessionId })
      .populate('userId', 'displayName email')
      .sort({ joinedAt: -1 });

    res.json({
      success: true,
      members: memberships.map(m => ({
        id: m.userId._id,
        displayName: m.userId.displayName,
        email: m.userId.email,
        joinedAt: m.joinedAt,
        messageCount: m.messageCount,
      })),
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching members',
      error: error.message,
    });
  }
});

// Get enrolled students for a session (lecturer only)
router.get('/:sessionId/students', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);
    
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.lecturer.toString() !== req.session.userId) return res.status(403).json({ success: false, message: 'Access denied' });

    const memberships = await Membership.find({ sessionId }).populate('userId', 'displayName email');
    const students = memberships.filter(m => m.userId).map(m => ({
      id: m.userId._id,
      displayName: m.userId.displayName || 'Unknown',
      email: m.userId.email || '',
      joinedAt: m.joinedAt
    }));

    res.json({ success: true, students, count: students.length });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add student by email (lecturer only)
router.post('/:sessionId/add-student', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.lecturer.toString() !== req.session.userId) return res.status(403).json({ success: false, message: 'Access denied' });

    const student = await User.findOne({ email: email.toLowerCase().trim(), role: 'student' });
    if (!student) return res.status(404).json({ success: false, message: 'No student account found with this email' });

    const existing = await Membership.findOne({ userId: student._id, sessionId: session._id });
    if (existing) return res.status(400).json({ success: false, message: 'Student is already enrolled' });

    await new Membership({ userId: student._id, sessionId: session._id }).save();
    res.json({ success: true, message: `${student.displayName} added to session` });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Remove student (lecturer only)
router.delete('/:sessionId/remove-student/:studentId', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId, studentId } = req.params;
    const session = await Session.findById(sessionId);
    
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.lecturer.toString() !== req.session.userId) return res.status(403).json({ success: false, message: 'Access denied' });

    const result = await Membership.findOneAndDelete({ userId: studentId, sessionId });
    if (!result) return res.status(404).json({ success: false, message: 'Student not found in session' });

    res.json({ success: true, message: 'Student removed' });
  } catch (error) {
    console.error('Remove student error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Bulk add students (lecturer only)
router.post('/:sessionId/add-students-bulk', isAuthenticated, isLecturer, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails)) return res.status(400).json({ success: false, message: 'Array of emails required' });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.lecturer.toString() !== req.session.userId) return res.status(403).json({ success: false, message: 'Access denied' });

    const results = { added: [], alreadyEnrolled: [], notFound: [] };

    for (const email of emails) {
      const normalizedEmail = email.toLowerCase().trim();
      const student = await User.findOne({ email: normalizedEmail, role: 'student' });

      if (!student) { results.notFound.push(normalizedEmail); continue; }

      const existing = await Membership.findOne({ userId: student._id, sessionId: session._id });
      if (existing) { results.alreadyEnrolled.push(normalizedEmail); continue; }

      await new Membership({ userId: student._id, sessionId: session._id }).save();
      results.added.push({ email: normalizedEmail, displayName: student.displayName });
    }

    res.json({ success: true, message: `Added ${results.added.length} students`, results });
  } catch (error) {
    console.error('Bulk add error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
