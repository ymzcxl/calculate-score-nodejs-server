const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  roomId: {
    type: String,
    required: true,
    index: true
  },
  roomTitle: {
    type: String,
    default: '好友牌局'
  },
  playerName: {
    type: String,
    required: true
  },
  playerAvatar: {
    type: String,
    default: ''
  },
  time: {
    type: String,
    required: true
  },
  result: {
    type: String,
    required: true,
    enum: ['win', 'lose', 'draw']
  },
  score: {
    type: Number,
    required: true
  },
  opponents: {
    type: [String],
    required: true
  },
  rank: {
    type: Number,
    required: true
  },
  playerCount: {
    type: Number,
    required: true
  },
  scoreChanges: {
    type: Number,
    default: 0
  },
  settledAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('History', HistorySchema);
