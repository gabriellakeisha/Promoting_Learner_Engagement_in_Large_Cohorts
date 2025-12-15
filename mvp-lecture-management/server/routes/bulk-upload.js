const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { isAuthenticated, isAdmin, isLecturer } = require('../middleware/auth');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Bulk upload users from CSV
router.post('/upload-users', isAuthenticated, upload.single('csvFile'), async (req, res) => {
  try {
    // Check if user is lecturer or admin
    if (req.session.userRole !== 'lecturer' && req.session.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only lecturers and admins can bulk upload users',
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No CSV file uploaded' 
      });
    }

    const results = [];
    const errors = [];
    let lineNumber = 0;

    // Parse CSV file
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (row) => {
        lineNumber++;
        results.push({ ...row, lineNumber });
      })
      .on('end', async () => {
        const createdUsers = [];
        const skippedUsers = [];

        // Process each row
        for (const row of results) {
          try {
            const { email, password, role, displayName } = row;

            // Validation
            if (!email || !password || !displayName) {
              errors.push({
                line: row.lineNumber,
                error: 'Missing required fields (email, password, displayName)',
                data: row,
              });
              continue;
            }

            // Check if user already exists
            const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
            if (existingUser) {
              skippedUsers.push({
                line: row.lineNumber,
                email,
                reason: 'User already exists',
              });
              continue;
            }

            // Create user
            const user = new User({
              email: email.toLowerCase().trim(),
              password,
              displayName: displayName.trim(),
              role: role?.toLowerCase().trim() || 'student',
            });

            await user.save();
            createdUsers.push({
              email: user.email,
              displayName: user.displayName,
              role: user.role,
            });
          } catch (error) {
            errors.push({
              line: row.lineNumber,
              error: error.message,
              data: row,
            });
          }
        }

        // Delete uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          message: 'Bulk upload completed',
          summary: {
            totalRows: results.length,
            created: createdUsers.length,
            skipped: skippedUsers.length,
            errors: errors.length,
          },
          createdUsers,
          skippedUsers,
          errors,
        });
      });
  } catch (error) {
    console.error('Bulk upload error:', error);
    
    // Clean up file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      success: false, 
      message: 'Server error during bulk upload',
      error: error.message 
    });
  }
});

module.exports = router;
