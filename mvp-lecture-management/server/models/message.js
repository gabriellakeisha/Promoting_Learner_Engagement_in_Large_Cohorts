const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxLength: 1000,
  },
  type: {
    type: String,
    enum: ['QUESTION', 'COMMENT', 'CONFUSION'],
    default: 'COMMENT',
  },
  
  identityMode: {
    type: String,
    enum: ['anonymous', 'pseudonymous', 'identified'],
    default: 'anonymous', // Default to anonymous for max engagement
  },
  
  // Alias for pseudonymous mode
  alias: {
    type: String,
    default: null,
    maxLength: 50,
  },
  // ============================================
  
  // Reply reference
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
  },
  
  isDeleted: {
    type: Boolean,
    default: false,
  },
  
  isEdited: {
    type: Boolean,
    default: false,
  },
  
  isPinned: {
    type: Boolean,
    default: false,
  },
  
  isAnnouncement: {
    type: Boolean,
    default: false,
  },
  
  isReported: {
    type: Boolean,
    default: false,
  },
  
  reactions: {
    type: Map,
    of: Number,
    default: {},
  },
});

// Indexes for performance
messageSchema.index({ sessionId: 1, timestamp: -1 });
messageSchema.index({ userId: 1 });
messageSchema.index({ sessionId: 1, identityMode: 1 }); // For analytics by mode

module.exports = mongoose.model('Message', messageSchema);