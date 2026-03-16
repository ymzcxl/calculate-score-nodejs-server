const express = require('express');
const router = express.Router();
const scoreController = require('../controllers/scoreController');
const auth = require('../middleware/auth');

// 更新分数
router.post('/update', auth, scoreController.updateScore);

// 获取分数历史
router.get('/history', auth, scoreController.getScoreHistory);

module.exports = router;