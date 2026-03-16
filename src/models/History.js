const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('History', HistorySchema);