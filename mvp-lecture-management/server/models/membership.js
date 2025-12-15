const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  messageCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Compound unique index to prevent duplicate memberships
membershipSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

// Method to increment message count
membershipSchema.methods.incrementMessageCount = async function() {
  this.messageCount += 1;
  await this.save();
};

module.exports = mongoose.model('Membership', membershipSchema);
