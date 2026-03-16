const Message = require('../models/Message');

// 发送消息
exports.sendMessage = async (req, res) => {
  try {
    const { roomId, content, type } = req.body;
    const { uid } = req.user;
    
    // 验证消息类型
    if (!['user', 'system'].includes(type)) {
      return res.status(400).json({
        code: 400,
        message: '消息类型无效'
      });
    }
    
    // 创建消息
    const message = new Message({
      roomId,
      userId: uid,
      content,
      type
    });
    await message.save();
    
    res.json({
      code: 200,
      data: {
        messageId: message._id,
        content: message.content,
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
    
    res.json({
      code: 200,
      data: messages.map(msg => ({
        messageId: msg._id,
        userId: msg.userId,
        content: msg.content,
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