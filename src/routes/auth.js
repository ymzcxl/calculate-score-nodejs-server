const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 微信登录
router.post('/wechat', authController.wechatLogin);

// 手机号登录
router.post('/phone', authController.phoneLogin);

// 注册
router.post('/register', authController.register);

// 退出登录
router.post('/logout', authController.logout);

// 重置密码
router.post('/reset-password', authController.resetPassword);

// 绑定手机号
router.post('/bind-phone', authController.bindPhone);

module.exports = router;