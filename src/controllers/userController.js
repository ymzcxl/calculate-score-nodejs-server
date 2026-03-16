const User = require('../models/User');

// 获取用户信息
exports.getUserInfo = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }
    
    res.json({
      code: 200,
      data: {
        uid: user.uid,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
        phone: user.phone
      },
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取失败'
    });
  }
};

// 更新用户信息
exports.updateUserInfo = async (req, res) => {
  try {
    const { nickName, avatarUrl } = req.body;
    
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }
    
    // 更新用户信息
    if (nickName) user.nickName = nickName;
    if (avatarUrl) user.avatarUrl = avatarUrl;
    
    await user.save();
    
    res.json({
      code: 200,
      data: {
        uid: user.uid,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl
      },
      message: '更新成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '更新失败'
    });
  }
};