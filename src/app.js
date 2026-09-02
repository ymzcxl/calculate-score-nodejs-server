const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { migrateUserIndexes } = require('./utils/userIndexMigration');

// 加载环境变量
dotenv.config();

// 初始化Express应用
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 数据库连接
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  keepAlive: true,
  keepAliveInitialDelay: 300000
}).then(async () => {
  console.log('MongoDB连接成功');
  try {
    await migrateUserIndexes();
    console.log('用户索引检查完成');
  } catch (error) {
    console.error('用户索引检查失败:', error);
  }
}).catch(err => {
  console.error('MongoDB连接失败:', err);
});

// 监听数据库连接事件
mongoose.connection.on('connected', () => {
  console.log('MongoDB连接已建立');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB连接错误:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB连接已断开');
});

// 路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const roomRoutes = require('./routes/room');
const scoreRoutes = require('./routes/score');
const messageRoutes = require('./routes/message');
const historyRoutes = require('./routes/history');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/room', roomRoutes);
app.use('/api/score', scoreRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/history', historyRoutes);

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    next();
    return;
  }

  res.sendFile(path.join(publicDir, 'index.html'));
});

// Socket.io事件处理
io.on('connection', (socket) => {
  console.log('新客户端连接:', socket.id);
  
  // 加入房间
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`客户端 ${socket.id} 加入房间 ${roomId}`);
    io.to(roomId).emit('player-joined', { socketId: socket.id });
  });
  
  // 离开房间
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`客户端 ${socket.id} 离开房间 ${roomId}`);
    io.to(roomId).emit('player-left', { socketId: socket.id });
  });
  
  // 分数更新
  socket.on('score-updated', (data) => {
    const { roomId } = data;
    io.to(roomId).emit('score-updated', data);
  });
  
  // 新消息
  socket.on('new-message', (data) => {
    const { roomId } = data;
    io.to(roomId).emit('new-message', data);
  });

  socket.on('room-settled', (data) => {
    const { roomId } = data;
    io.to(roomId).emit('room-settled', data);
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('客户端断开连接:', socket.id);
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = { app, io };
