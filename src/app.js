const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { migrateUserIndexes } = require('./utils/userIndexMigration');

// 加载环境变量
dotenv.config();

// 初始化Express应用
const app = express();

const parseCorsOrigins = () => {
  const rawOrigins = (process.env.CORS_ORIGIN || '').trim();
  if (!rawOrigins || rawOrigins === '*') {
    return '*';
  }

  return rawOrigins
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

const corsOrigins = parseCorsOrigins();
const allowCredentials = corsOrigins !== '*';
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: allowCredentials
  }
});
app.set('io', io);

// 中间件
app.use(cors({
  origin: corsOrigins,
  credentials: allowCredentials
}));
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

app.get('/', (req, res) => {
  res.json({
    code: 200,
    message: 'scoring backend service is running',
    data: {
      service: 'scoring-backend',
      frontend: 'separated',
      apiBase: '/api'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    code: 200,
    message: 'ok',
    data: {
      status: 'healthy',
      database: mongoose.connection.readyState
    }
  });
});

// Socket.io事件处理
io.on('connection', (socket) => {
  console.log('新客户端连接:', socket.id);

  const resolveRoomId = (payload) => {
    if (typeof payload === 'string') return payload;
    return payload?.roomId || '';
  };

  const broadcastToRoom = (eventName, payload) => {
    const roomId = resolveRoomId(payload);
    if (!roomId) return;
    io.to(roomId).emit(eventName, payload);
  };
  
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
    broadcastToRoom('score-updated', data);
  });
  
  // 新消息
  socket.on('new-message', (data) => {
    broadcastToRoom('new-message', data);
  });

  socket.on('room-settled', (data) => {
    broadcastToRoom('room-settled', data);
  });

  socket.on('room-closed', (data) => {
    broadcastToRoom('room-closed', data);
  });

  socket.on('player-updated', (data) => {
    broadcastToRoom('player-updated', data);
  });

  socket.on('interaction', (data = {}) => {
    const roomId = resolveRoomId(data);
    if (!roomId || !data.fromUserId || !data.emoji) return;

    const payload = {
      roomId,
      interactionId: data.interactionId || `${Date.now()}_${socket.id}`,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId || '',
      emoji: data.emoji,
      name: data.name || '',
      timestamp: data.timestamp || new Date().toISOString()
    };

    io.to(roomId).emit('room-interaction', payload);
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
