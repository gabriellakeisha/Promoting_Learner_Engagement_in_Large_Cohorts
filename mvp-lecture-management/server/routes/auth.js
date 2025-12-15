const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName, role } = req.body;

    // Validation
    if (!email || !password || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and display name are required',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Create new user
    const user = new User({
      email: email.toLowerCase(),
      password,
      displayName,
      role: role || 'student',
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update login tracking
    await user.updateLoginTracking();

    // CRITICAL: Save user info to session
    req.session.userId = user._id.toString();
    req.session.userEmail = user.email;
    req.session.userRole = user.role;
    req.session.displayName = user.displayName;

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({
          success: false,
          message: 'Error saving session',
        });
      }

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user._id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          lastLogin: user.lastLogin,
          loginCount: user.loginCount,
        },
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message,
    });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  try {
    if (req.session && req.session.userId) {
      // Set user offline
      await User.findByIdAndUpdate(req.session.userId, { isOnline: false });

      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Error during logout',
          });
        }

        res.clearCookie('connect.sid');
        res.json({
          success: true,
          message: 'Logout successful',
        });
      });
    } else {
      res.json({
        success: true,
        message: 'Already logged out',
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout',
      error: error.message,
    });
  }
});

// Get current user
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      success: true,
      user: {
        id: req.session.userId,
        email: req.session.userEmail,
        displayName: req.session.displayName,
        role: req.session.userRole,
      },
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Not authenticated',
    });
  }
});

module.exports = router;
