const mongoose = require('mongoose');

const ScoreHistorySchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  fromUserId: {
    type: String,
    required: true,
    index: true
  },
  toUserId: {
    type: String,
    required: true,
    index: true
  },
  score: {
    type: Number,
    required: true
  },
  operatorUserId: {
    type: String,
    required: true,
    index: true
  },
  fromUserScoreAfter: {
    type: Number,
    required: true
  },
  toUserScoreAfter: {
    type: Number,
    required: true
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  revokeRequestStatus: {
    type: String,
    enum: ['none', 'pending', 'approved'],
    default: 'none',
    index: true
  },
  revokeRequestedBy: {
    type: String,
    default: '',
    index: true
  },
  revokeRequestedAt: {
    type: Date,
    default: null
  },
  revokedAt: {
    type: Date,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ScoreHistory', ScoreHistorySchema);
