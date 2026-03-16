const History = require('../models/History');

// 获取历史记录
exports.getHistoryList = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const { uid } = req.user;
    
    // 获取历史记录
    const history = await History.find({ userId: uid })
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));
    
    res.json({
      code: 200,
      data: history.map(item => ({
        time: item.time,
        result: item.result,
        score: item.score,
        opponents: item.opponents
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

// 添加历史记录
exports.addHistory = async (req, res) => {
  try {
    const { time, result, score, opponents } = req.body;
    const { uid } = req.user;
    
    // 验证结果类型
    if (!['win', 'lose', 'draw'].includes(result)) {
      return res.status(400).json({
        code: 400,
        message: '结果类型无效'
      });
    }
    
    // 创建历史记录
    const history = new History({
      userId: uid,
      time,
      result,
      score,
      opponents
    });
    await history.save();
    
    res.json({
      code: 200,
      data: {
        historyId: history._id
      },
      message: '添加成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '添加失败'
    });
  }
};

// 清空历史记录
exports.clearHistory = async (req, res) => {
  try {
    const { uid } = req.user;
    
    // 删除用户的所有历史记录
    await History.deleteMany({ userId: uid });
    
    res.json({
      code: 200,
      data: {},
      message: '历史记录已清空'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '清空失败'
    });
  }
};

// 获取统计数据
exports.getStats = async (req, res) => {
  try {
    const { uid } = req.user;
    
    // 获取所有历史记录
    const history = await History.find({ userId: uid });
    
    // 计算统计数据
    const totalGames = history.length;
    const winGames = history.filter(item => item.result === 'win').length;
    const winRate = totalGames > 0 ? Math.round((winGames / totalGames) * 100) : 0;
    const totalScore = history.reduce((sum, item) => sum + item.score, 0);
    const averageScore = totalGames > 0 ? parseFloat((totalScore / totalGames).toFixed(1)) : 0;
    const bestScore = history.length > 0 ? Math.max(...history.map(item => item.score)) : 0;
    
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
    res.status(500).json({
      code: 500,
      message: '获取失败'
    });
  }
};