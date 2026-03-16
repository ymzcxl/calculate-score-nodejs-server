const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

// 发送消息
router.post('/send', auth, messageController.sendMessage);

// 获取消息记录
router.get('/history', auth, messageController.getMessageHistory);

module.exports = router;