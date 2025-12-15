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
  isDeleted: {
    type: Boolean,
    default: false,
  },
  isPinned: {
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

// Compound index for efficient querying
messageSchema.index({ sessionId: 1, timestamp: -1 });

// Method to soft delete message
messageSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  await this.save();
};

// Method to edit message
messageSchema.methods.editMessage = async function(newText) {
  this.text = newText;
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
};

// Method to pin message
messageSchema.methods.togglePin = async function() {
  this.isPinned = !this.isPinned;
  await this.save();
};

module.exports = mongoose.model('Message', messageSchema);
