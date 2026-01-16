const mongoose = require('mongoose');

const StudentReflectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  goal: {
    text: { type: String, maxLength: 200 },
    targetCount: { type: Number, default: 0 },
    achievedCount: { type: Number, default: 0 },
    createdAt: { type: Date },
  },
  reflection: {
    understanding: { type: Number, min: 1, max: 5 },
    confusingTopic: { type: String, maxLength: 300 },
    improvement: { type: String, maxLength: 300 },
    submittedAt: { type: Date },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

StudentReflectionSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model('StudentReflection', StudentReflectionSchema);