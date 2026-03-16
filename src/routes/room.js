const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const auth = require('../middleware/auth');

// 创建房间
router.post('/create', auth, roomController.createRoom);

// 加入房间
router.post('/join', auth, roomController.joinRoom);

// 获取房间信息
router.get('/info', auth, roomController.getRoomInfo);

// 关闭房间
router.post('/close', auth, roomController.closeRoom);

// 退出房间
router.post('/exit', auth, roomController.exitRoom);

module.exports = router;