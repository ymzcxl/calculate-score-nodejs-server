const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// 生成唯一用户ID
const generateUid = () => {
  return 'user_' + crypto.randomBytes(8).toString('hex');
};

// 生成令牌
const generateToken = (user) => {
  return jwt.sign(
    { uid: user.uid, nickName: user.nickName },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// 验证令牌
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// 微信登录
exports.wechatLogin = async (req, res) => {
  try {
    const { code, userInfo } = req.body;
    
    // 这里应该调用微信API验证code，获取openid
    // 为了演示，直接模拟openid
    const wechatOpenId = 'openid_' + crypto.randomBytes(8).toString('hex');
    
    // 查找用户
    let user = await User.findOne({ wechatOpenId });
    
    if (!user) {
      // 创建新用户
      user = new User({
        uid: generateUid(),
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        wechatOpenId
      });
      await user.save();
    }
    
    // 生成令牌
    const token = generateToken(user);
    
    res.json({
      code: 200,
      data: {
        token,
        user: {
          uid: user.uid,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl
        }
      },
      message: '登录成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '登录失败'
    });
  }
};

// 手机号登录
exports.phoneLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    // 查找用户
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({
        code: 400,
        message: '用户不存在'
      });
    }
    
    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        code: 400,
        message: '密码错误'
      });
    }
    
    // 生成令牌
    const token = generateToken(user);
    
    res.json({
      code: 200,
      data: {
        token,
        user: {
          uid: user.uid,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl
        }
      },
      message: '登录成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '登录失败'
    });
  }
};

// 注册
exports.register = async (req, res) => {
  try {
    const { phone, password, confirmPassword, nickName, wechatCode } = req.body;
    console.log('注册请求:', { phone, nickName, password: password ? '***' : 'undefined', wechatCode: wechatCode ? '存在' : '不存在' });
    
    // 参数验证
    if (!phone || !password || !confirmPassword || !nickName || !wechatCode) {
      console.log('参数不完整:', { phone, password: password ? '存在' : '不存在', confirmPassword: confirmPassword ? '存在' : '不存在', nickName, wechatCode: wechatCode ? '存在' : '不存在' });
      return res.status(400).json({
        code: 400,
        message: '请填写完整的注册信息'
      });
    }
    
    // 检查密码是否一致
    if (password !== confirmPassword) {
      console.log('两次密码不一致');
      return res.status(400).json({
        code: 400,
        message: '两次密码输入不一致'
      });
    }
    
    // 检查手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      console.log('手机号格式错误:', phone);
      return res.status(400).json({
        code: 400,
        message: '请输入正确的手机号'
      });
    }
    
    // 检查密码长度
    if (password.length < 6) {
      console.log('密码长度不足:', password.length);
      return res.status(400).json({
        code: 400,
        message: '密码长度至少6位'
      });
    }
    
    // 检查昵称长度
    if (nickName.length < 2) {
      console.log('昵称长度不足:', nickName.length);
      return res.status(400).json({
        code: 400,
        message: '昵称长度至少2位'
      });
    }
    
    // 模拟微信登录验证
    const wechatOpenId = 'openid_' + crypto.randomBytes(8).toString('hex');
    
    // 检查手机号是否已存在
    console.log('检查手机号是否已存在');
    const existingUserByPhone = await User.findOne({ phone });
    if (existingUserByPhone) {
      console.log('手机号已注册:', phone);
      return res.status(400).json({
        code: 400,
        message: '手机号已注册'
      });
    }
    
    // 检查微信是否已存在
    console.log('检查微信是否已存在');
    let user = await User.findOne({ wechatOpenId });
    if (user) {
      // 微信已登录，绑定手机号
      console.log('微信已登录，绑定手机号');
      user.phone = phone;
      user.password = await bcrypt.hash(password, 10);
      user.nickName = nickName;
    } else {
      // 创建新用户
      console.log('创建新用户');
      user = new User({
        uid: generateUid(),
        phone,
        password: await bcrypt.hash(password, 10),
        nickName,
        avatarUrl: 'https://via.placeholder.com/150',
        wechatOpenId
      });
    }
    
    console.log('保存用户');
    await user.save();
    console.log('用户保存成功:', user.uid);
    
    // 生成令牌
    console.log('生成令牌');
    const token = generateToken(user);
    
    res.json({
      code: 200,
      data: {
        token,
        user: {
          uid: user.uid,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl,
          phone: user.phone
        }
      },
      message: '注册成功'
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({
      code: 500,
      message: '注册失败'
    });
  }
};

// 退出登录
exports.logout = async (req, res) => {
  try {
    console.log('用户退出登录');
    // JWT是无状态的，退出登录只需要客户端删除token即可
    // 这里可以添加一些额外的处理，比如记录退出日志等
    res.json({
      code: 200,
      message: '退出成功'
    });
  } catch (error) {
    console.error('退出失败:', error);
    res.status(500).json({
      code: 500,
      message: '退出失败'
    });
  }
};



// 重置密码
exports.resetPassword = async (req, res) => {
  try {
    const { wechatCode, phone, newPassword, confirmPassword } = req.body;
    console.log('重置密码:', { phone, wechatCode: wechatCode ? '存在' : '不存在' });
    
    // 参数验证
    if (!wechatCode || !phone || !newPassword || !confirmPassword) {
      console.log('参数不完整');
      return res.status(400).json({
        code: 400,
        message: '请填写完整的信息'
      });
    }
    
    // 检查密码是否一致
    if (newPassword !== confirmPassword) {
      console.log('两次密码不一致');
      return res.status(400).json({
        code: 400,
        message: '两次密码输入不一致'
      });
    }
    
    // 检查密码长度
    if (newPassword.length < 6) {
      console.log('密码长度不足:', newPassword.length);
      return res.status(400).json({
        code: 400,
        message: '密码长度至少6位'
      });
    }
    
    // 模拟微信登录验证
    const wechatOpenId = 'openid_' + crypto.randomBytes(8).toString('hex');
    
    // 查找用户（微信和手机号关联）
    const user = await User.findOne({ wechatOpenId, phone });
    if (!user) {
      console.log('用户不存在或微信未关联手机号:', phone);
      return res.status(400).json({
        code: 400,
        message: '用户不存在或微信未关联手机号'
      });
    }
    
    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新密码
    user.password = hashedPassword;
    await user.save();
    
    console.log('密码重置成功:', phone);
    res.json({
      code: 200,
      message: '密码重置成功'
    });
  } catch (error) {
    console.error('重置密码失败:', error);
    res.status(500).json({
      code: 500,
      message: '重置密码失败'
    });
  }
};

// 微信登录关联手机号
exports.bindPhone = async (req, res) => {
  try {
    const { wechatCode, phone, password } = req.body;
    console.log('绑定手机号:', { phone });
    
    // 模拟微信登录验证
    const wechatOpenId = 'openid_' + crypto.randomBytes(8).toString('hex');
    
    // 查找微信用户
    let user = await User.findOne({ wechatOpenId });
    if (!user) {
      // 创建新用户
      user = new User({
        uid: generateUid(),
        wechatOpenId,
        nickName: '微信用户',
        avatarUrl: 'https://via.placeholder.com/150'
      });
    }
    
    // 检查手机号是否已被其他用户使用
    const existingUser = await User.findOne({ phone, _id: { $ne: user._id } });
    if (existingUser) {
      console.log('手机号已被其他用户使用:', phone);
      return res.status(400).json({
        code: 400,
        message: '手机号已被其他用户使用'
      });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 更新用户信息
    user.phone = phone;
    user.password = hashedPassword;
    
    await user.save();
    
    // 生成令牌
    const token = generateToken(user);
    
    console.log('手机号绑定成功:', phone);
    res.json({
      code: 200,
      data: {
        token,
        user: {
          uid: user.uid,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl,
          phone: user.phone
        }
      },
      message: '手机号绑定成功'
    });
  } catch (error) {
    console.error('绑定手机号失败:', error);
    res.status(500).json({
      code: 500,
      message: '绑定手机号失败'
    });
  }
};