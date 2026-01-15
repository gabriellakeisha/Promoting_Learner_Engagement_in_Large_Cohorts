const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');

// ========================================
// UPDATE DISPLAY NAME
// ========================================
router.put('/display-name', isAuthenticated, async (req, res) => {
  try {
    const { displayName } = req.body;
    
    if (!displayName || displayName.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Display name must be at least 2 characters' 
      });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.displayName = displayName.trim();
    await user.save();

    // Update session
    req.session.displayName = user.displayName;

    res.json({
      success: true,
      message: 'Display name updated',
      displayName: user.displayName
    });
    
  } catch (error) {
    console.error('Update display name error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ========================================
// CHANGE PASSWORD
// ========================================
router.put('/password', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both passwords required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password must be at least 6 characters' 
      });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Update password (hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;