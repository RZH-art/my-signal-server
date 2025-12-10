const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// 关键配置：允许所有来源连接
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 一个健康检查路由
app.get('/', (req, res) => {
  res.send('Signal Server is Running');
});

const rooms = {};

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
        // 这里修正了：data.room 而不是 data, room
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

// ！！！关键修正：正确的导出函数（用于Vercel/Render等云平台）
module.exports = (req, res) => {
  app(req, res);
};

// 仅在本地直接运行时才执行（云平台会忽略这部分）
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`本地服务器运行在端口 ${PORT}`);
  });
}
