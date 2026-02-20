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
  originalText: {
    type: String,
    default: null,
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
  deletedAt: {
    type: Date,
    default: null,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  isEdited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  editHistory: [{
    text: String,
    editedAt: { type: Date, default: Date.now }
  }],
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
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  reportedAt: {
    type: Date,
    default: null,
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

messageSchema.methods.softDelete = async function(deletedByUserId) {
  if (!this.originalText) {
    this.originalText = this.text;
  }
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedByUserId || this.userId;
  await this.save();
};

messageSchema.methods.editMessage = async function(newText) {
  if (!this.editHistory) {
    this.editHistory = [];
  }
  this.editHistory.push({
    text: this.text,
    editedAt: new Date()
  });
  if (!this.originalText) {
    this.originalText = this.text;
  }
  this.text = newText;
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
};

messageSchema.methods.togglePin = async function() {
  this.isPinned = !this.isPinned;
  await this.save();
};

module.exports = mongoose.model('Message', messageSchema);