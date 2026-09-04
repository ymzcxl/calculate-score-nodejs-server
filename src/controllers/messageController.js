const Message = require('../models/Message');
const Player = require('../models/Player');
const Room = require('../models/Room');

const mapMessage = (message, userName = '玩家', extra = {}) => ({
  messageId: message._id,
  userId: message.userId,
  userName,
  content: message.content,
  targetUserId: message.targetUserId || '',
  targetScope: message.targetUserId ? 'player' : 'room',
  type: message.type,
  timestamp: message.timestamp,
  ...extra
});

const emitRoomEvent = (req, eventName, payload) => {
  const io = req.app.get('io');
  if (!io || !payload?.roomId) {
    return;
  }

  io.to(payload.roomId).emit(eventName, payload);
};

const getActiveRoomAndSender = async (roomId, uid) => {
  const room = await Room.findOne({ roomId, status: 'active' });
  if (!room) {
    const error = new Error('房间不存在或已结束');
    error.statusCode = 404;
    throw error;
  }

  const sender = await Player.findOne({ roomId, userId: uid });
  if (!sender) {
    const error = new Error('您不在当前房间中');
    error.statusCode = 403;
    throw error;
  }

  return { room, sender };
};

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

    const { sender } = await getActiveRoomAndSender(roomId, uid);

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
      data: mapMessage(message, sender.name || '玩家'),
      message: '消息发送成功'
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      code: error.statusCode || 500,
      message: error.message || '消息发送失败'
    });
  }
};

exports.sendLeaderboardNotice = async (req, res) => {
  try {
    const { roomId } = req.body;
    const { uid } = req.user;

    if (!roomId) {
      return res.status(400).json({
        code: 400,
        message: '缺少房间号'
      });
    }

    const { sender } = await getActiveRoomAndSender(roomId, uid);
    const players = await Player.find({ roomId }).sort({ score: -1, joinedAt: 1, _id: 1 });

    if (!players.length) {
      return res.status(400).json({
        code: 400,
        message: '当前房间暂无玩家'
      });
    }

    const leaderScore = players[0].score;
    const leaders = players
      .filter((player) => player.score === leaderScore)
      .map((player) => ({
        userId: player.userId,
        name: player.name,
        avatar: player.avatar || '',
        score: player.score
      }));

    const leaderNames = leaders.map((player) => player.name).join('、');
    const content = leaders.length > 1
      ? `提醒大家关注当前并列领先者：${leaderNames}（${leaderScore > 0 ? `+${leaderScore}` : leaderScore}）`
      : `提醒大家关注当前领先者：${leaderNames}（${leaderScore > 0 ? `+${leaderScore}` : leaderScore}）`;

    const message = await Message.create({
      roomId,
      userId: uid,
      content,
      targetUserId: '',
      type: 'system'
    });

    const payload = mapMessage(message, sender.name || '玩家', {
      noticeType: 'leaderboard',
      initiatorUserId: uid,
      leaders,
      leaderScore
    });

    emitRoomEvent(req, 'leaderboard-notice', payload);
    emitRoomEvent(req, 'new-message', payload);

    res.json({
      code: 200,
      data: payload,
      message: '排行榜通知已发送'
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      code: error.statusCode || 500,
      message: error.message || '发送排行榜通知失败'
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
      data: messages.map(msg => mapMessage(msg, playerMap.get(msg.userId) || '玩家')),
      message: '获取成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取失败'
    });
  }
};
