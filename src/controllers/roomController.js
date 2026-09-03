const crypto = require('crypto');
const History = require('../models/History');
const Player = require('../models/Player');
const Room = require('../models/Room');
const ScoreHistory = require('../models/ScoreHistory');
const User = require('../models/User');

const generateRoomId = () => crypto.randomBytes(3).toString('hex').toUpperCase();

const mapPlayer = (player) => ({
  userId: player.userId,
  name: player.name,
  avatar: player.avatar || '',
  score: player.score,
  joinedAt: player.joinedAt
});

const getPlayers = async (roomId) => {
  const players = await Player.find({ roomId }).sort({ joinedAt: 1, _id: 1 });
  return players.map(mapPlayer);
};

const buildRoomPayload = async (room) => ({
  roomId: room.roomId,
  title: room.title,
  creator: room.creator,
  status: room.status,
  createdAt: room.createdAt,
  settledAt: room.settledAt,
  players: await getPlayers(room.roomId)
});

const sendError = (res, error, fallbackMessage) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    code: status,
    message: error.message || fallbackMessage
  });
};

exports.createRoom = async (req, res) => {
  try {
    const { uid } = req.user;
    const { title } = req.body;
    const roomId = generateRoomId();

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    const room = await Room.create({
      roomId,
      creator: uid,
      title: title || `${user.nickName}的牌局`,
      status: 'active'
    });

    await Player.create({
      roomId,
      userId: uid,
      name: user.nickName,
      avatar: user.avatarUrl || '',
      score: 0
    });

    res.json({
      code: 200,
      data: await buildRoomPayload(room),
      message: '房间创建成功'
    });
  } catch (error) {
    sendError(res, error, '房间创建失败');
  }
};

exports.joinRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    const { uid } = req.user;

    const room = await Room.findOne({ roomId, status: 'active' });
    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '房间不存在或已结束'
      });
    }

    const user = await User.findOne({ uid });
    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    const existingPlayer = await Player.findOne({ roomId, userId: uid });
    if (!existingPlayer) {
      await Player.create({
        roomId,
        userId: uid,
        name: user.nickName,
        avatar: user.avatarUrl || '',
        score: 0
      });
    }

    res.json({
      code: 200,
      data: await buildRoomPayload(room),
      message: '加入房间成功'
    });
  } catch (error) {
    sendError(res, error, '加入房间失败');
  }
};

exports.getRoomInfo = async (req, res) => {
  try {
    const { roomId } = req.query;
    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '房间不存在'
      });
    }

    res.json({
      code: 200,
      data: await buildRoomPayload(room),
      message: '获取成功'
    });
  } catch (error) {
    sendError(res, error, '获取房间信息失败');
  }
};

exports.updatePlayerName = async (req, res) => {
  try {
    const { roomId, name } = req.body;
    const { uid } = req.user;

    if (!roomId || !name || !name.trim()) {
      return res.status(400).json({
        code: 400,
        message: '请输入玩家名称'
      });
    }

    const player = await Player.findOne({ roomId, userId: uid });
    if (!player) {
      return res.status(404).json({
        code: 404,
        message: '玩家不在当前房间中'
      });
    }

    player.name = name.trim();
    await player.save();

    res.json({
      code: 200,
      data: mapPlayer(player),
      message: '名称更新成功'
    });
  } catch (error) {
    sendError(res, error, '更新名称失败');
  }
};

exports.settleRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    const { uid } = req.user;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '房间不存在'
      });
    }

    if (room.creator !== uid) {
      return res.status(403).json({
        code: 403,
        message: '只有房主可以结束对局'
      });
    }

    if (room.status !== 'active') {
      return res.status(400).json({
        code: 400,
        message: '对局已结束'
      });
    }

    const players = await Player.find({ roomId }).sort({ score: -1, joinedAt: 1 });
    if (!players.length) {
      return res.status(400).json({
        code: 400,
        message: '房间内没有玩家'
      });
    }

    const scoreLogs = await ScoreHistory.find({ roomId, isRevoked: false });
    const settledAt = new Date();
    const timeText = settledAt.toLocaleString('zh-CN', { hour12: false });

    await History.deleteMany({ roomId });

    const historyDocs = players.map((player, index) => {
      const opponents = players
        .filter(item => item.userId !== player.userId)
        .map(item => item.name);

      const topScore = players[0].score;
      const result = player.score === topScore
        ? 'win'
        : player.score === 0
          ? 'draw'
          : 'lose';

      return {
        userId: player.userId,
        roomId,
        roomTitle: room.title,
        playerName: player.name,
        playerAvatar: player.avatar || '',
        time: timeText,
        result,
        score: player.score,
        opponents,
        rank: index + 1,
        playerCount: players.length,
        scoreChanges: scoreLogs.filter(log =>
          log.fromUserId === player.userId || log.toUserId === player.userId
        ).length,
        settledAt
      };
    });

    await History.insertMany(historyDocs);

    room.status = 'closed';
    room.settledAt = settledAt;
    room.closedAt = settledAt;
    await room.save();

    res.json({
      code: 200,
      data: {
        roomId,
        settledAt,
        rankings: players.map((player, index) => ({
          rank: index + 1,
          userId: player.userId,
          name: player.name,
          avatar: player.avatar || '',
          score: player.score
        }))
      },
      message: '对局已结束'
    });
  } catch (error) {
    sendError(res, error, '结束对局失败');
  }
};

exports.closeRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    const { uid } = req.user;
    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '房间不存在'
      });
    }

    if (room.creator !== uid) {
      return res.status(403).json({
        code: 403,
        message: '只有房主可以关闭房间'
      });
    }

    room.status = 'closed';
    room.closedAt = new Date();
    await room.save();

    res.json({
      code: 200,
      data: {
        roomId,
        status: room.status
      },
      message: '房间已关闭'
    });
  } catch (error) {
    sendError(res, error, '关闭房间失败');
  }
};

exports.exitRoom = async (req, res) => {
  try {
    const { roomId } = req.body;
    const { uid } = req.user;
    const player = await Player.findOne({ roomId, userId: uid });

    if (!player) {
      return res.status(400).json({
        code: 400,
        message: '您不在该房间中'
      });
    }

    await player.deleteOne();

    res.json({
      code: 200,
      data: {
        roomId
      },
      message: '已退出房间'
    });
  } catch (error) {
    sendError(res, error, '退出房间失败');
  }
};

// 替补接管分数
exports.takeoverSeat = async (req, res) => {
  try {
    const { roomId, targetUserId } = req.body;
    const currentUserId = req.user.uid;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ code: 400, message: '不能接管自己' });
    }

    const room = await Room.findOne({ roomId, status: 'active' });
    if (!room) {
      return res.status(404).json({ code: 404, message: '房间不存在或已结束' });
    }

    // 获取当前用户
    const currentUser = await User.findOne({ uid: currentUserId });
    if (!currentUser) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 查找双方玩家记录
    const targetPlayer = await Player.findOne({ roomId, userId: targetUserId });
    let currentPlayer = await Player.findOne({ roomId, userId: currentUserId });

    if (!targetPlayer) {
      return res.status(404).json({ code: 404, message: '目标玩家不在该房间内' });
    }

    // 如果当前用户不在房间里，先创建一个0分的记录
    if (!currentPlayer) {
      currentPlayer = new Player({
        roomId,
        userId: currentUserId,
        name: currentUser.nickName,
        avatar: currentUser.avatarUrl,
        score: 0
      });
    }

    // 转移分数
    currentPlayer.score += targetPlayer.score;
    await currentPlayer.save();

    // 转移记分历史中的身份 (把历史记录里的 targetUserId 全部替换为 currentUserId)
    await ScoreHistory.updateMany(
      { roomId, fromUserId: targetUserId },
      { $set: { fromUserId: currentUserId } }
    );
    await ScoreHistory.updateMany(
      { roomId, toUserId: targetUserId },
      { $set: { toUserId: currentUserId } }
    );

    // 房主接管处理：如果被接管的是房主，则把房主转让给当前用户
    if (room.creator === targetUserId) {
      room.creator = currentUserId;
      await room.save();
    }

    // 删除被接管玩家
    await Player.deleteOne({ _id: targetPlayer._id });

    // 通知全房间更新
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('player-updated', {
        roomId,
        message: `${currentUser.nickName} 接管了 ${targetPlayer.name} 的位置和分数！`
      });
    }

    res.json({
      code: 200,
      message: '接管成功'
    });

  } catch (error) {
    console.error('Takeover Error:', error);
    res.status(500).json({ code: 500, message: '接管失败' });
  }
};


