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

    fromPlayer.score += history.score;
    toPlayer.score -= history.score;
    history.isRevoked = true;
    history.revokedAt = new Date();

    await Promise.all([fromPlayer.save(), toPlayer.save(), history.save()]);

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
      message: '已撤回上一笔记分'
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
