// 极简信令服务器 - 用于帮助两个玩家建立直接连接
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // 允许任何网页连接
});

// 记录房间和玩家的对应关系
const rooms = {};

io.on('connection', (socket) => {
    console.log('新用户连接:', socket.id);

    // 加入房间
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        rooms[socket.id] = roomId;
        
        const roomMembers = io.sockets.adapter.rooms.get(roomId);
        const playerCount = roomMembers ? roomMembers.size : 0;
        
        console.log(`用户 ${socket.id} 加入房间 ${roomId} (当前${playerCount}人)`);
        
        // 告诉房间里所有人新的玩家列表
        io.to(roomId).emit('room_update', {
            count: playerCount,
            members: Array.from(roomMembers)
        });
        
        // 如果是房间里的第二个人，让第一个人开始发起WebRTC连接
        if (playerCount === 2) {
            socket.to(roomId).emit('start_webrtc', { target: socket.id });
        }
    });
    
    // 转发WebRTC信令（offer/answer/candidate）
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
    
    // 断开连接
    socket.on('disconnect', () => {
        const roomId = rooms[socket.id];
        if (roomId) {
            socket.to(roomId).emit('player_left', { id: socket.id });
            delete rooms[socket.id];
        }
        console.log('用户断开:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`信令服务器运行在端口 ${PORT}`);
});