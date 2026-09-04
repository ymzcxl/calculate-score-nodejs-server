const Player = require('../models/Player');
const Room = require('../models/Room');
const ScoreHistory = require('../models/ScoreHistory');

const getActiveRoom = async (roomId) => Room.findOne({ roomId, status: 'active' });

const ensureRoomAndPlayers = async (roomId, fromUserId, toUserId) => {
  const room = await getActiveRoom(roomId);
  if (!room) {
    const error = new Error('房间不存在或已结束');
    error.statusCode = 404;
    throw error;
  }

  const [fromPlayer, toPlayer] = await Promise.all([
    Player.findOne({ roomId, userId: fromUserId }),
    Player.findOne({ roomId, userId: toUserId })
  ]);

  if (!fromPlayer || !toPlayer) {
    const error = new Error('房间玩家信息不存在');
    error.statusCode = 404;
    throw error;
  }

  return { room, fromPlayer, toPlayer };
};

const mapHistoryItem = (item) => ({
  id: item._id,
  roomId: item.roomId,
  fromUserId: item.fromUserId,
  toUserId: item.toUserId,
  operatorUserId: item.operatorUserId,
  score: item.score,
  fromUserScoreAfter: item.fromUserScoreAfter,
  toUserScoreAfter: item.toUserScoreAfter,
  isRevoked: item.isRevoked,
  revokeRequestStatus: item.revokeRequestStatus || 'none',
  revokeRequestedBy: item.revokeRequestedBy || '',
  revokeRequestedAt: item.revokeRequestedAt,
  revokedAt: item.revokedAt,
  timestamp: item.timestamp
});

const sendError = (res, error, fallbackMessage) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    code: status,
    message: error.message || fallbackMessage
  });
};

exports.updateScore = async (req, res) => {
  try {
    const { roomId, fromUserId, toUserId, score } = req.body;
    const parsedScore = Number(score);

    if (!roomId || !fromUserId || !toUserId) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数'
      });
    }

    if (req.user.uid !== fromUserId) {
      return res.status(403).json({
        code: 403,
        message: '只能操作自己的记分'
      });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({
        code: 400,
        message: '不能给自己记分'
      });
    }

    if (!Number.isFinite(parsedScore) || parsedScore <= 0) {
      return res.status(400).json({
        code: 400,
        message: '分数必须为正数'
      });
    }

    const { fromPlayer, toPlayer } = await ensureRoomAndPlayers(roomId, fromUserId, toUserId);

    fromPlayer.score -= parsedScore;
    toPlayer.score += parsedScore;

    await Promise.all([fromPlayer.save(), toPlayer.save()]);

    const history = await ScoreHistory.create({
      roomId,
      fromUserId,
      toUserId,
      operatorUserId: req.user.uid,
      score: parsedScore,
      fromUserScoreAfter: fromPlayer.score,
      toUserScoreAfter: toPlayer.score
    });

    res.json({
      code: 200,
      data: {
        history: mapHistoryItem(history),
        fromUser: {
          userId: fromPlayer.userId,
          score: fromPlayer.score
        },
        toUser: {
          userId: toPlayer.userId,
          score: toPlayer.score
        }
      },
      message: '分数更新成功'
    });
  } catch (error) {
    sendError(res, error, '分数更新失败');
  }
};

exports.revokeLastScore = async (req, res) => {
  try {
    const { roomId } = req.body;
    const { uid } = req.user;
    if (!roomId) {
      return res.status(400).json({
        code: 400,
        message: '缺少房间号'
      });
    }

    const room = await getActiveRoom(roomId);
    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '房间不存在或已结束'
      });
    }

    const history = await ScoreHistory.findOne({ roomId, isRevoked: false }).sort({ timestamp: -1 });
    if (!history) {
      return res.status(400).json({
        code: 400,
        message: '暂无可撤回的记分记录'
      });
    }

    const [fromPlayer, toPlayer] = await Promise.all([
      Player.findOne({ roomId, userId: history.fromUserId }),
      Player.findOne({ roomId, userId: history.toUserId })
    ]);

    if (!fromPlayer || !toPlayer) {
      return res.status(404).json({
        code: 404,
        message: '玩家信息不存在'
      });
    }

    const participants = [history.fromUserId, history.toUserId];
    if (!participants.includes(uid)) {
      return res.status(403).json({
        code: 403,
        message: '只有本笔记分相关人员可以处理撤回'
      });
    }

    const io = req.app.get('io');

    if (history.revokeRequestStatus === 'pending' && uid === history.toUserId && uid !== history.revokeRequestedBy) {
      fromPlayer.score += history.score;
      toPlayer.score -= history.score;
      history.isRevoked = true;
      history.revokedAt = new Date();
      history.revokeRequestStatus = 'approved';

      await Promise.all([fromPlayer.save(), toPlayer.save(), history.save()]);

      if (io) {
        io.to(roomId).emit('player-updated', {
          roomId,
          message: `${toPlayer.name} 已同意撤回上一笔记分`
        });
      }

      return res.json({
        code: 200,
        data: {
          status: 'approved',
          history: mapHistoryItem(history),
          fromUser: {
            userId: fromPlayer.userId,
            score: fromPlayer.score
          },
          toUser: {
            userId: toPlayer.userId,
            score: toPlayer.score
          }
        },
        message: '已撤回上一笔记分'
      });
    }

    if (history.revokeRequestStatus === 'pending') {
      return res.status(409).json({
        code: 409,
        message: '上一笔记分已经在等待确认'
      });
    }

    if (uid !== history.fromUserId) {
      fromPlayer.score += history.score;
      toPlayer.score -= history.score;
      history.isRevoked = true;
      history.revokedAt = new Date();
      history.revokeRequestStatus = 'approved';

      await Promise.all([fromPlayer.save(), toPlayer.save(), history.save()]);

      if (io) {
        io.to(roomId).emit('player-updated', {
          roomId,
          message: `${toPlayer.name} 直接确认撤回了上一笔记分`
        });
      }

      return res.json({
        code: 200,
        data: {
          status: 'approved',
          history: mapHistoryItem(history),
          fromUser: {
            userId: fromPlayer.userId,
            score: fromPlayer.score
          },
          toUser: {
            userId: toPlayer.userId,
            score: toPlayer.score
          }
        },
        message: '已撤回上一笔记分'
      });
    }

    history.revokeRequestStatus = 'pending';
    history.revokeRequestedBy = uid;
    history.revokeRequestedAt = new Date();
    await history.save();

    if (io) {
      io.to(roomId).emit('player-updated', {
        roomId,
        message: `${fromPlayer.name} 发起了撤回申请，等待 ${toPlayer.name} 确认`
      });
    }

    res.json({
      code: 200,
      data: {
        status: 'pending',
        history: mapHistoryItem(history),
        approverUserId: toPlayer.userId
      },
      message: `已发起撤回申请，等待 ${toPlayer.name} 确认`
    });
  } catch (error) {
    sendError(res, error, '撤回记分失败');
  }
};

exports.getScoreHistory = async (req, res) => {
  try {
    const { roomId } = req.query;
    if (!roomId) {
      return res.status(400).json({
        code: 400,
        message: '缺少房间号'
      });
    }

    const history = await ScoreHistory.find({ roomId }).sort({ timestamp: -1 });
    res.json({
      code: 200,
      data: history.map(mapHistoryItem),
      message: '获取成功'
    });
  } catch (error) {
    sendError(res, error, '获取分数历史失败');
  }
};
