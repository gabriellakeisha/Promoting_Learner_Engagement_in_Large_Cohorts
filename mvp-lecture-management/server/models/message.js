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
    required: function() { return !this.isPoll && !(this.attachment && this.attachment.dataUrl); },
    maxLength: 1000,
  },
  type: {
    type: String,
    enum: ['NONE', 'QUESTION', 'COMMENT', 'CONFUSION', 'POLL'],
    default: 'NONE',
  },
  identityMode: {
    type: String,
    enum: ['anonymous', 'pseudonymous', 'identified'],
    default: 'anonymous',
  },
  alias: {
    type: String,
    default: null,
    maxLength: 50,
  },
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
    of: [String],
    default: new Map(),
  },
  isPoll: {
    type: Boolean,
    default: false,
  },
  poll: {
    question: {
      type: String,
      maxLength: 500,
    },
    options: [{
      id: String,
      text: String,
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    allowMultiple: {
      type: Boolean,
      default: false,
    },
    isAnonymous: {
      type: Boolean,
      default: true,
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
    endsAt: {
      type: Date,
      default: null,
    }
  },
  attachment: {
    dataUrl: { type: String, default: null },
    filename: { type: String, default: null },
    mimetype: { type: String, default: null },
    size: { type: Number, default: null },
  }
});

messageSchema.index({ sessionId: 1, timestamp: -1 });
messageSchema.index({ userId: 1 });
messageSchema.index({ sessionId: 1, identityMode: 1 });
messageSchema.index({ sessionId: 1, isPoll: 1 });

module.exports = mongoose.model('Message', messageSchema);