const User = require('../models/User');
const Room = require('../models/Room');
const Player = require('../models/Player');

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
    
    // 查找用户当前正在进行的活跃房间
    const activePlayer = await Player.findOne({ userId: user.uid }).sort({ joinedAt: -1 });
    let activeRoomId = null;
    let activeRoomIsCreator = false;
    
    if (activePlayer) {
      const room = await Room.findOne({ roomId: activePlayer.roomId, status: 'active' });
      if (room) {
        activeRoomId = room.roomId;
        activeRoomIsCreator = (room.creator === user.uid);
      }
    }
    
    res.json({
      code: 200,
      data: {
        uid: user.uid,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        activeRoomId: activeRoomId, // 返回当前活跃房间号
        activeRoomIsCreator: activeRoomIsCreator // 是否是该活跃房间的房主
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