const Message = require('../models/Message');
const Player = require('../models/Player');
const Room = require('../models/Room');

// 发送消息
exports.sendMessage = async (req, res) => {
  try {
    const { roomId, content, type, targetUserId = '' } = req.body;
    const { uid } = req.user;
    const trimmedContent = String(content || '').trim();
    const normalizedTargetUserId = String(targetUserId || '').trim();

    if (!roomId || !trimmedContent) {
      return res.status(400).json({
        code: 400,
        message: '房间号和消息内容不能为空'
      });
    }
    
    // 验证消息类型
    if (!['user', 'system'].includes(type)) {
      return res.status(400).json({
        code: 400,
        message: '消息类型无效'
      });
    }

    const room = await Room.findOne({ roomId, status: 'active' });
    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '房间不存在或已结束'
      });
    }

    const sender = await Player.findOne({ roomId, userId: uid });
    if (!sender) {
      return res.status(403).json({
        code: 403,
        message: '您不在当前房间中'
      });
    }

    if (normalizedTargetUserId && normalizedTargetUserId !== uid) {
      const targetPlayer = await Player.findOne({ roomId, userId: normalizedTargetUserId });
      if (!targetPlayer) {
        return res.status(404).json({
          code: 404,
          message: '目标玩家不存在'
        });
      }
    }
    
    // 创建消息
    const message = new Message({
      roomId,
      userId: uid,
      content: trimmedContent,
      targetUserId: normalizedTargetUserId,
      type
    });
    await message.save();

    res.json({
      code: 200,
      data: {
        messageId: message._id,
        userId: message.userId,
        userName: sender.name || '玩家',
        content: message.content,
        targetUserId: message.targetUserId || '',
        targetScope: message.targetUserId ? 'player' : 'room',
        type: message.type,
        timestamp: message.timestamp
      },
      message: '消息发送成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '消息发送失败'
    });
  }
};

// 获取消息记录
exports.getMessageHistory = async (req, res) => {
  try {
    const { roomId, limit = 50, offset = 0 } = req.query;
    
    // 获取消息记录
    const messages = await Message.find({ roomId })
      .sort({ timestamp: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));
    
    const players = await Player.find({ roomId, userId: { $in: messages.map(item => item.userId) } });
    const playerMap = new Map(players.map(item => [item.userId, item.name]));

    res.json({
      code: 200,
      data: messages.map(msg => ({
        messageId: msg._id,
        userId: msg.userId,
        userName: playerMap.get(msg.userId) || '玩家',
        content: msg.content,
        targetUserId: msg.targetUserId || '',
        targetScope: msg.targetUserId ? 'player' : 'room',
        type: msg.type,
        timestamp: msg.timestamp
      })),
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取失败'
    });
  }
};
