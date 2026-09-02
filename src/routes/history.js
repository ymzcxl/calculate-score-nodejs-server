const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');
const auth = require('../middleware/auth');

// 获取历史记录
router.get('/list', auth, historyController.getHistoryList);

// 获取历史详情
router.get('/detail', auth, historyController.getHistoryDetail);

// 清空历史记录
router.post('/clear', auth, historyController.clearHistory);

// 获取统计数据
router.get('/stats', auth, historyController.getStats);

module.exports = router;
