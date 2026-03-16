const Room = require('../models/Room');
const Player = require('../models/Player');
const User = require('../models/User');
const crypto = require('crypto');

// 生成房间号
const generateRoomId = () => {
  return 'room_' + crypto.randomBytes(6).toString('hex');
};

// 创建房间
exports.createRoom = async (req, res) => {
  try {
    const { uid } = req.user;
    
    // 生成房间号
    const roomId = generateRoomId();
    
    // 创建房间
    const room = new Room({
      roomId,
      creator: uid,
      status: 'active'
    });
    await room.save();
    
    // 获取用户信息
    const user = await User.findOne({ uid });
    
    // 创建玩家记录
    const player = new Player({
      roomId,
      userId: uid,
      name: user.nickName,
      avatar: user.avatarUrl,
      score: 0
    });
    await player.save();
    
    res.json({
      code: 200,
      data: {
        roomId,
        creator: uid
      },
      message: '房间创建成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '房间创建失败'
    });
  }
};

// 加入房间
exports.joinRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    const { uid } = req.user;
    
    // 检查房间是否存在
    const room = await Room.findOne({ roomId, status: 'active' });
    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '房间不存在或已关闭'
      });
    }
    
    // 检查用户是否已在房间中
    const existingPlayer = await Player.findOne({ roomId, userId: uid });
    if (existingPlayer) {
      return res.status(400).json({
        code: 400,
        message: '您已在该房间中'
      });
    }
    
    // 获取用户信息
    const user = await User.findOne({ uid });
    
    // 创建玩家记录
    const player = new Player({
      roomId,
      userId: uid,
      name: user.nickName,
      avatar: user.avatarUrl,
      score: 0
    });
    await player.save();
    
    // 获取房间内所有玩家
    const players = await Player.find({ roomId });
    
    res.json({
      code: 200,
      data: {
        roomId,
        players: players.map(p => ({
          userId: p.userId,
          name: p.name,
          avatar: p.avatar,
          score: p.score
        }))
      },
      message: '加入房间成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '加入房间失败'
    });
  }
};

// 获取房间信息
exports.getRoomInfo = async (req, res) => {
  try {
    const { roomId } = req.query;
    
    // 检查房间是否存在
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '房间不存在'
      });
    }
    
    // 获取房间内所有玩家
    const players = await Player.find({ roomId });
    
    res.json({
      code: 200,
      data: {
        roomId: room.roomId,
        creator: room.creator,
        status: room.status,
        players: players.map(p => ({
          userId: p.userId,
          name: p.name,
          avatar: p.avatar,
          score: p.score
        }))
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

// 关闭房间
exports.closeRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    const { uid } = req.user;
    
    // 检查房间是否存在
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '房间不存在'
      });
    }
    
    // 检查是否是房间创建者
    if (room.creator !== uid) {
      return res.status(403).json({
        code: 403,
        message: '只有房间创建者可以关闭房间'
      });
    }
    
    // 关闭房间
    room.status = 'closed';
    await room.save();
    
    res.json({
      code: 200,
      data: {
        roomId,
        status: 'closed'
      },
      message: '房间已关闭'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '关闭房间失败'
    });
  }
};

// 退出房间
exports.exitRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    const { uid } = req.user;
    
    // 检查玩家是否在房间中
    const player = await Player.findOne({ roomId, userId: uid });
    if (!player) {
      return res.status(400).json({
        code: 400,
        message: '您不在该房间中'
      });
    }
    
    // 删除玩家记录
    await player.remove();
    
    res.json({
      code: 200,
      data: {
        roomId
      },
      message: '已退出房间'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '退出房间失败'
    });
  }
};