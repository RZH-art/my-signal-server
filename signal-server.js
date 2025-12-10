const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// 关键配置
const io = new Server(server, {
  cors: {
    origin: "*", // 允许所有前端域名连接
    methods: ["GET", "POST"]
  }
});

// 一个健康检查路由，用于测试
app.get('/', (req, res) => {
  res.send('Signal Server is Running on Vercel');
});

const rooms = {};

// 以下是你原有的 Socket.io 业务逻辑，保持不变
io.on('connection', (socket) => {
    console.log('新用户连接:', socket.id);

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        rooms[socket.id] = roomId;
        const roomMembers = io.sockets.adapter.rooms.get(roomId);
        const playerCount = roomMembers ? roomMembers.size : 0;
        console.log(`用户 ${socket.id} 加入房间 ${roomId} (当前${playerCount}人)`);
        io.to(roomId).emit('room_update', { count: playerCount });
        if (playerCount === 2) {
            socket.to(roomId).emit('start_webrtc', { target: socket.id });
        }
    });

    socket.on('webrtc_signal', (data) => {
        socket.to(data.target).emit('webrtc_signal', {
            from: socket.id,
            signal: data.signal
        });
    });

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
        console.log('用户断开:', socket.id);
    });
});

// 关键修改：导出 app 和 server，供 Vercel 使用
module.exports = (req, res) => {
  // 将 HTTP 请求交给 Express 处理
  app(req, res);
};

// 仅在本地运行时才直接监听端口（Vercel环境不需要这一行）
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`本地服务器运行在端口 ${PORT}`);
  });
}
