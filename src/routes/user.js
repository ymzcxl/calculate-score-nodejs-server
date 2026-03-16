const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// 获取用户信息
router.get('/info', auth, userController.getUserInfo);

// 更新用户信息
router.post('/update', auth, userController.updateUserInfo);

module.exports = router;