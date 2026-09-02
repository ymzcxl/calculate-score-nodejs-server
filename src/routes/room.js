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

// 更新房间内名称
router.post('/player-name', auth, roomController.updatePlayerName);

// 结束对局并结算
router.post('/settle', auth, roomController.settleRoom);

// 关闭房间
router.post('/close', auth, roomController.closeRoom);

// 退出房间
router.post('/exit', auth, roomController.exitRoom);

module.exports = router;
