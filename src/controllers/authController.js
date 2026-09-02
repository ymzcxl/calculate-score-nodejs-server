const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { resolveWechatSession } = require('../utils/wechat');

const PHONE_REGEX = /^1[3-9]\d{9}$/;

const generateUid = () => `user_${crypto.randomBytes(8).toString('hex')}`;

const generateToken = (user) => jwt.sign(
  { uid: user.uid, nickName: user.nickName },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

const serializeUser = (user) => ({
  uid: user.uid,
  nickName: user.nickName,
  avatarUrl: user.avatarUrl || '',
  phone: user.phone || ''
});

const sendError = (res, error, fallbackMessage) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    code: status,
    message: error.message || fallbackMessage
  });
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const validatePhone = (phone) => {
  if (!PHONE_REGEX.test(phone || '')) {
    throw createValidationError('请输入正确的手机号');
  }
};

const validatePassword = (password, confirmPassword) => {
  if (!password || password.length < 6) {
    throw createValidationError('密码长度至少 6 位');
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw createValidationError('两次密码输入不一致');
  }
};

const validateNickname = (nickName, label = '昵称') => {
  if (!nickName || nickName.trim().length < 2) {
    throw createValidationError(`${label}长度至少 2 位`);
  }
};

exports.wechatLogin = async (req, res) => {
  try {
    const { code, userInfo = {} } = req.body;
    const { openId } = await resolveWechatSession(code);

    let user = await User.findOne({ wechatOpenId: openId });
    if (!user) {
      user = new User({
        uid: generateUid(),
        nickName: userInfo.nickName || '微信用户',
        avatarUrl: userInfo.avatarUrl || '',
        wechatOpenId: openId
      });
    } else {
      if (userInfo.nickName) {
        user.nickName = userInfo.nickName;
      }
      if (userInfo.avatarUrl) {
        user.avatarUrl = userInfo.avatarUrl;
      }
    }

    await user.save();

    res.json({
      code: 200,
      data: {
        token: generateToken(user),
        user: serializeUser(user)
      },
      message: '登录成功'
    });
  } catch (error) {
    sendError(res, error, '微信登录失败');
  }
};

exports.phoneLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;
    validatePhone(phone);

    if (!password) {
      throw createValidationError('请输入密码');
    }

    const user = await User.findOne({ phone });
    if (!user || !user.password) {
      return res.status(400).json({
        code: 400,
        message: '账号或密码错误'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        code: 400,
        message: '账号或密码错误'
      });
    }

    res.json({
      code: 200,
      data: {
        token: generateToken(user),
        user: serializeUser(user)
      },
      message: '登录成功'
    });
  } catch (error) {
    sendError(res, error, '登录失败');
  }
};

exports.register = async (req, res) => {
  try {
    const { phone, password, confirmPassword, nickName } = req.body;

    validatePhone(phone);
    validatePassword(password, confirmPassword);
    validateNickname(nickName);

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        code: 400,
        message: '手机号已注册'
      });
    }

    const user = await User.create({
      uid: generateUid(),
      phone,
      password: await bcrypt.hash(password, 10),
      nickName: nickName.trim(),
      avatarUrl: ''
    });

    res.json({
      code: 200,
      data: {
        token: generateToken(user),
        user: serializeUser(user)
      },
      message: '注册成功'
    });
  } catch (error) {
    sendError(res, error, '注册失败');
  }
};

exports.logout = async (req, res) => {
  res.json({
    code: 200,
    message: '退出成功'
  });
};

exports.resetPassword = async (req, res) => {
  try {
    const { phone, nickName, newPassword, confirmPassword } = req.body;
    validatePhone(phone);
    validateNickname(nickName, '昵称');
    validatePassword(newPassword, confirmPassword);

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({
        code: 400,
        message: '账号不存在'
      });
    }

    if ((user.nickName || '').trim() !== nickName.trim()) {
      return res.status(400).json({
        code: 400,
        message: '手机号与昵称不匹配'
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      code: 200,
      message: '密码重置成功'
    });
  } catch (error) {
    sendError(res, error, '重置密码失败');
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (!oldPassword) {
      throw createValidationError('请输入当前密码');
    }

    validatePassword(newPassword, confirmPassword);

    const user = await User.findOne({ uid: req.user.uid });
    if (!user || !user.password) {
      return res.status(404).json({
        code: 404,
        message: '账号不存在'
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        code: 400,
        message: '当前密码错误'
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      code: 200,
      message: '密码修改成功'
    });
  } catch (error) {
    sendError(res, error, '修改密码失败');
  }
};

exports.bindPhone = async (req, res) => {
  try {
    const { phone, password, confirmPassword } = req.body;
    validatePhone(phone);
    validatePassword(password, confirmPassword || password);

    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    const existingUser = await User.findOne({ phone, _id: { $ne: user._id } });
    if (existingUser) {
      return res.status(400).json({
        code: 400,
        message: '手机号已被其他账号绑定'
      });
    }

    user.phone = phone;
    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({
      code: 200,
      data: {
        token: generateToken(user),
        user: serializeUser(user)
      },
      message: '手机号绑定成功'
    });
  } catch (error) {
    sendError(res, error, '绑定手机号失败');
  }
};
