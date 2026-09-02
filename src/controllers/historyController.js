const History = require('../models/History');
const ScoreHistory = require('../models/ScoreHistory');

const sendError = (res, error, fallbackMessage) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    code: status,
    message: error.message || fallbackMessage
  });
};

exports.getHistoryList = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const { uid } = req.user;

    const history = await History.find({ userId: uid })
      .sort({ settledAt: -1, createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    res.json({
      code: 200,
      data: history.map(item => ({
        roomId: item.roomId,
        roomTitle: item.roomTitle,
        playerName: item.playerName,
        playerAvatar: item.playerAvatar,
        time: item.time,
        result: item.result,
        score: item.score,
        opponents: item.opponents,
        rank: item.rank,
        playerCount: item.playerCount,
        scoreChanges: item.scoreChanges,
        settledAt: item.settledAt
      })),
      message: '获取成功'
    });
  } catch (error) {
    sendError(res, error, '获取历史记录失败');
  }
};

exports.getHistoryDetail = async (req, res) => {
  try {
    const { roomId } = req.query;
    if (!roomId) {
      return res.status(400).json({
        code: 400,
        message: '缺少房间号'
      });
    }

    const { uid } = req.user;
    const current = await History.findOne({ userId: uid, roomId });
    if (!current) {
      return res.status(404).json({
        code: 404,
        message: '未找到该对局历史'
      });
    }

    const [records, scoreLogs] = await Promise.all([
      History.find({ roomId }).sort({ rank: 1, score: -1 }),
      ScoreHistory.find({ roomId }).sort({ timestamp: -1 })
    ]);

    res.json({
      code: 200,
      data: {
        roomId,
        roomTitle: current.roomTitle,
        settledAt: current.settledAt,
        rankings: records.map(item => ({
          userId: item.userId,
          name: item.playerName,
          avatar: item.playerAvatar,
          score: item.score,
          rank: item.rank,
          result: item.result
        })),
        scoreLogs: scoreLogs.map(item => ({
          id: item._id,
          fromUserId: item.fromUserId,
          toUserId: item.toUserId,
          operatorUserId: item.operatorUserId,
          score: item.score,
          fromUserScoreAfter: item.fromUserScoreAfter,
          toUserScoreAfter: item.toUserScoreAfter,
          isRevoked: item.isRevoked,
          revokedAt: item.revokedAt,
          timestamp: item.timestamp
        }))
      },
      message: '获取成功'
    });
  } catch (error) {
    sendError(res, error, '获取历史详情失败');
  }
};

exports.clearHistory = async (req, res) => {
  try {
    const { uid } = req.user;
    await History.deleteMany({ userId: uid });

    res.json({
      code: 200,
      data: {},
      message: '历史记录已清空'
    });
  } catch (error) {
    sendError(res, error, '清空历史失败');
  }
};

exports.getStats = async (req, res) => {
  try {
    const { uid } = req.user;
    const history = await History.find({ userId: uid });

    const totalGames = history.length;
    const winGames = history.filter(item => item.result === 'win').length;
    const winRate = totalGames > 0 ? Math.round((winGames / totalGames) * 100) : 0;
    const totalScore = history.reduce((sum, item) => sum + item.score, 0);
    const averageScore = totalGames > 0 ? Number((totalScore / totalGames).toFixed(1)) : 0;
    const bestScore = totalGames > 0 ? Math.max(...history.map(item => item.score)) : 0;

    res.json({
      code: 200,
      data: {
        totalGames,
        winGames,
        winRate,
        totalScore,
        averageScore,
        bestScore
      },
      message: '获取成功'
    });
  } catch (error) {
    sendError(res, error, '获取统计数据失败');
  }
};
