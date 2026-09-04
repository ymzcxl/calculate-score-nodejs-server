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

const mapPlayerScore = (player) => ({
  userId: player.userId,
  name: player.name,
  avatar: player.avatar || '',
  score: player.score
});

const emitRoomEvent = (req, eventName, payload) => {
  const io = req.app.get('io');
  if (!io || !payload?.roomId) {
    return;
  }

  io.to(payload.roomId).emit(eventName, payload);
};

const buildRevokePayload = (history, fromPlayer, toPlayer, action, status) => ({
  roomId: history.roomId,
  action,
  status,
  requesterUserId: history.revokeRequestedBy || history.fromUserId,
  approverUserId: history.toUserId,
  history: mapHistoryItem(history),
  fromUser: mapPlayerScore(fromPlayer),
  toUser: mapPlayerScore(toPlayer)
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
    const { roomId, action: rawAction = '' } = req.body;
    const { uid } = req.user;
    const action = ['request', 'approve'].includes(rawAction) ? rawAction : '';
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
    if (history.revokeRequestStatus === 'pending') {
      if (uid === history.revokeRequestedBy) {
        return res.status(409).json({
          code: 409,
          message: `撤回申请已发出，等待 ${toPlayer.name} 确认`,
          data: buildRevokePayload(history, fromPlayer, toPlayer, 'request', 'pending')
        });
      }

      if (uid !== history.toUserId) {
        return res.status(403).json({
          code: 403,
          message: '只有被记分方可以确认撤回'
        });
      }

      if (action === 'request') {
        return res.status(409).json({
          code: 409,
          message: '当前撤回申请正在等待确认，请执行确认操作',
          data: buildRevokePayload(history, fromPlayer, toPlayer, 'request', 'pending')
        });
      }

      fromPlayer.score += history.score;
      toPlayer.score -= history.score;
      history.isRevoked = true;
      history.revokedAt = new Date();
      history.revokeRequestStatus = 'approved';

      await Promise.all([fromPlayer.save(), toPlayer.save(), history.save()]);

      const payload = buildRevokePayload(history, fromPlayer, toPlayer, 'approve', 'approved');
      payload.message = `${toPlayer.name} 已确认撤回上一笔记分`;

      emitRoomEvent(req, 'score-revoked', payload);
      emitRoomEvent(req, 'score-updated', {
        roomId,
        reason: 'revoke-approved',
        historyId: history._id
      });
      emitRoomEvent(req, 'player-updated', {
        roomId,
        message: payload.message
      });

      return res.json({
        code: 200,
        data: payload,
        message: '已撤回上一笔记分'
      });
    }

    if (action === 'approve') {
      return res.status(409).json({
        code: 409,
        message: '当前没有待确认的撤回申请'
      });
    }

    if (uid !== history.fromUserId) {
      return res.status(403).json({
        code: 403,
        message: '只有发起记分的一方可以申请撤回'
      });
    }

    history.revokeRequestStatus = 'pending';
    history.revokeRequestedBy = uid;
    history.revokeRequestedAt = new Date();
    await history.save();

    const payload = buildRevokePayload(history, fromPlayer, toPlayer, 'request', 'pending');
    payload.message = `${fromPlayer.name} 发起了撤回申请，等待 ${toPlayer.name} 确认`;

    emitRoomEvent(req, 'score-revoke-requested', payload);

    if (io) {
      io.to(roomId).emit('player-updated', {
        roomId,
        message: payload.message
      });
    }

    res.json({
      code: 200,
      data: payload,
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
