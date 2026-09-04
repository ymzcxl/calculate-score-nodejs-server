const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  targetUserId: {
    type: String,
    default: '',
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['user', 'system']
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', MessageSchema);
