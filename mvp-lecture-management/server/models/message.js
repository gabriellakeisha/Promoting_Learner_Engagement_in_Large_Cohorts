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
  timestamps: true, // This adds createdAt and updatedAt fields automatically
});

// Compound index for efficient querying
messageSchema.index({ sessionId: 1, timestamp: -1 });
messageSchema.index({ sessionId: 1, createdAt: 1 }); // For frontend compatibility

// Virtual field to ensure createdAt is always available
messageSchema.virtual('createdAtCompat').get(function() {
  return this.createdAt || this.timestamp;
});

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

// Export model, checking if it already exists to prevent OverwriteModelError
module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);