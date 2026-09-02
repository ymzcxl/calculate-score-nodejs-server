const mongoose = require('mongoose');

const normalizeOptionalString = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

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
    set: normalizeOptionalString
  },
  password: {
    type: String
  },
  wechatOpenId: {
    type: String,
    set: normalizeOptionalString
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

// Web 注册用户没有 wechatOpenId，微信用户也可能暂时未绑定手机号。
// 这里用部分唯一索引，只对真正有值的字段做唯一校验，避免多个 null 相互冲突。
UserSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $exists: true, $type: 'string' }
    }
  }
);

UserSchema.index(
  { wechatOpenId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      wechatOpenId: { $exists: true, $type: 'string' }
    }
  }
);

module.exports = mongoose.model('User', UserSchema);
