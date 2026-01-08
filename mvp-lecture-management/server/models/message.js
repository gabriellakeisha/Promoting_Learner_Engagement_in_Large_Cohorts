// server/models/Message.js - FIXED (NO VIRTUAL CONFLICT)

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['QUESTION', 'COMMENT', 'CONFUSION'],
    default: 'COMMENT'
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isAnnouncement: {
    type: Boolean,
    default: false
  },
  // Report functionality
  isReported: {
    type: Boolean,
    default: false
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reportedAt: {
    type: Date,
    default: null
  },
  reportReason: {
    type: String,
    maxlength: 500,
    default: null
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true // This creates createdAt and updatedAt automatically
});

// Index for efficient queries
messageSchema.index({ sessionId: 1, timestamp: -1 });
messageSchema.index({ sessionId: 1, isPinned: 1 });
messageSchema.index({ sessionId: 1, isDeleted: 1 });
messageSchema.index({ isReported: 1 });

// Instance method: Edit message
messageSchema.methods.editMessage = function(newText) {
  this.text = newText;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// Instance method: Toggle pin
messageSchema.methods.togglePin = function() {
  this.isPinned = !this.isPinned;
  return this.save();
};

// Instance method: Soft delete
messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Instance method: Report message
messageSchema.methods.reportMessage = function(reporterId, reason) {
  this.isReported = true;
  this.reportedBy = reporterId;
  this.reportedAt = new Date();
  this.reportReason = reason || 'No reason provided';
  return this.save();
};

// Instance method: Unreport message
messageSchema.methods.unreportMessage = function() {
  this.isReported = false;
  this.reportedBy = null;
  this.reportedAt = null;
  this.reportReason = null;
  return this.save();
};

// Static method: Get messages with filters
messageSchema.statics.getSessionMessages = function(sessionId, options = {}) {
  const query = {
    sessionId,
    isDeleted: false
  };
  
  if (options.pinnedOnly) {
    query.isPinned = true;
  }
  
  if (options.reportedOnly) {
    query.isReported = true;
  }
  
  return this.find(query)
    .populate('userId', 'displayName role')
    .populate('replyTo')
    .sort({ timestamp: 1 })
    .lean();
};

// Static method: Get reported messages (lecturer only)
messageSchema.statics.getReportedMessages = function(sessionId) {
  return this.find({
    sessionId,
    isReported: true,
    isDeleted: false
  })
    .populate('userId', 'displayName role')
    .populate('reportedBy', 'displayName role')
    .sort({ reportedAt: -1 })
    .lean();
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;