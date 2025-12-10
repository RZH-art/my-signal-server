const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 一个简单的根路由，用于测试服务器是否存活
app.get('/', (req, res) => {
  res.send('Render Signal Server is LIVE');
});

// 存储房间关系
const rooms = {};

io.on('connection', (socket) => {
  console.log('[连接] 新用户:', socket.id);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    rooms[socket.id] = roomId;
    const playerCount = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    console.log(`[房间] ${socket.id} 加入 ${roomId}， 当前${playerCount}人`);
    
    // 通知房间内所有人更新人数
    io.to(roomId).emit('room_update', { count: playerCount });
    
    // 当第二个人加入时，通知第一个人开始建立P2P连接
    if (playerCount === 2) {
      socket.to(roomId).emit('start_webrtc', { target: socket.id });
    }
  });

  // 转发所有WebRTC信令
  socket.on('webrtc_signal', (data) => {
    socket.to(data.target).emit('webrtc_signal', {
      from: socket.id,
      signal: data.signal
    });
  });

  // 转发游戏数据
  socket.on('game_data', (data) => {
    socket.to(data.room).emit('game_data', {
      from: socket.id,
      action: data.action,
      payload: data.payload
    });
  });

  socket.on('disconnect', () => {
    const roomId = rooms[socket.id];
    if (roomId) {
      socket.to(roomId).emit('player_left', { id: socket.id });
      delete rooms[socket.id];
    }
    console.log('[断开]', socket.id);
  });
});

// 在Render上，只需要监听环境变量PORT提供的端口
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ 信令服务器已在端口 ${PORT} 上成功启动`);
});
