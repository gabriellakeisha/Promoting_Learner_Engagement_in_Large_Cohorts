const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  joinCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  lecturer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  moduleCode: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'scheduled'],
    default: 'active',
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
    default: null,
  },
  settings: {
    allowAnonymous: {
      type: Boolean,
      default: true,
    },
    messageHistoryLimit: {
      type: Number,
      default: 50, // Initial load limit
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Generate random 6-character join code
sessionSchema.statics.generateJoinCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Method to end session
sessionSchema.methods.endSession = async function() {
  this.status = 'ended';
  this.endTime = new Date();
  await this.save();
};

module.exports = mongoose.model('Session', sessionSchema);
