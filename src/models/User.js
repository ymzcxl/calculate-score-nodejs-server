const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  nickName: {
    type: String,
    required: true,
    index: true
  },
  avatarUrl: {
    type: String
  },
  phone: {
    type: String,
    unique: true,
    index: true
  },
  password: {
    type: String
  },
  wechatOpenId: {
    type: String,
    unique: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', UserSchema);