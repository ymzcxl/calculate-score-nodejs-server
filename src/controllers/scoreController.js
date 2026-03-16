const Player = require('../models/Player');
const ScoreHistory = require('../models/ScoreHistory');

// 更新分数
exports.updateScore = async (req, res) => {
  try {
    const { roomId, fromUserId, toUserId, score } = req.body;
    
    // 验证分数必须为正数
    if (score <= 0) {
      return res.status(400).json({
        code: 400,
        message: '分数必须为正数'
      });
    }
    
    // 查找扣分用户
    const fromPlayer = await Player.findOne({ roomId, userId: fromUserId });
    if (!fromPlayer) {
      return res.status(404).json({
        code: 404,
        message: '扣分用户不在房间中'
      });
    }
    
    // 查找加分用户
    const toPlayer = await Player.findOne({ roomId, userId: toUserId });
    if (!toPlayer) {
      return res.status(404).json({
        code: 404,
        message: '加分用户不在房间中'
      });
    }
    
    // 更新分数
    fromPlayer.score -= score;
    toPlayer.score += score;
    
    await fromPlayer.save();
    await toPlayer.save();
    
    // 记录分数历史
    const scoreHistory = new ScoreHistory({
      roomId,
      fromUserId,
      toUserId,
      score
    });
    await scoreHistory.save();
    
    res.json({
      code: 200,
      data: {
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
    res.status(500).json({
      code: 500,
      message: '分数更新失败'
    });
  }
};

// 获取分数历史
exports.getScoreHistory = async (req, res) => {
  try {
    const { roomId } = req.query;
    
    // 获取分数历史记录
    const history = await ScoreHistory.find({ roomId }).sort({ timestamp: -1 });
    
    res.json({
      code: 200,
      data: history.map(item => ({
        fromUserId: item.fromUserId,
        toUserId: item.toUserId,
        score: item.score,
        timestamp: item.timestamp
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