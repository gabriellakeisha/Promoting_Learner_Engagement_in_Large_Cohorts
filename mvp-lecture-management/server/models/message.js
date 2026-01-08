const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 2000,
  },
  type: {
    type: String,
    enum: ['QUESTION', 'COMMENT', 'CONFUSION'],
    required: true,
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
    index: true
  },
  isDeleted: {
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
  isEdited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

messageSchema.index({ sessionId: 1, timestamp: -1 });
messageSchema.index({ sessionId: 1, createdAt: 1 });
messageSchema.index({ sessionId: 1, isPinned: 1 });

messageSchema.virtual('createdAtCompat').get(function() {
  return this.createdAt || this.timestamp;
});

messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

messageSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  await this.save();
};

messageSchema.methods.editMessage = async function(newText) {
  this.text = newText;
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
};

messageSchema.methods.togglePin = async function() {
  this.isPinned = !this.isPinned;
  await this.save();
};

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);