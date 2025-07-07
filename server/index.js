const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // allow all origins; you can restrict to 'https://live-typing-board.vercel.app'
    methods: ['GET', 'POST']
  }
});

// In-memory data stores
const roomText = {};         // roomId → shared text
const roomOwners = {};       // roomId → creator socketId
const roomUsers = {};        // roomId → array of { socketId, username }
const socketToRoom = {};     // socketId → roomId

function broadcastUserList(roomId) {
  const users = roomUsers[roomId]?.map(u => u.username) || [];
  io.to(roomId).emit('user_list', users);
}

function tryDeleteRoomIfEmpty(roomId) {
  const isEmpty = !roomUsers[roomId] || roomUsers[roomId].length === 0;
  if (isEmpty) {
    console.log(`🧹 Deleting empty room: ${roomId}`);
    delete roomText[roomId];
    delete roomOwners[roomId];
    delete roomUsers[roomId];
  }
}

io.on('connection', (socket) => {
  console.log(`🟢 Connected: ${socket.id}`);

  socket.on('create_room', (callback) => {
    const roomId = uuidv4().slice(0, 6);
    socket.join(roomId);
    roomText[roomId] = '';
    roomOwners[roomId] = socket.id;
    roomUsers[roomId] = [];
    socketToRoom[socket.id] = roomId;
    callback(roomId);
  });

  socket.on('join_room', ({ roomId, username }, callback) => {
    if (roomText[roomId] !== undefined) {
      socket.join(roomId);
      roomUsers[roomId].push({ socketId: socket.id, username });
      socketToRoom[socket.id] = roomId;
      broadcastUserList(roomId);
      callback({ success: true, text: roomText[roomId] });
    } else {
      callback({ success: false, message: 'Room not found' });
    }
  });

  socket.on('send_text', ({ roomId, text }) => {
    if (roomText[roomId] !== undefined) {
      roomText[roomId] = text;
      socket.to(roomId).emit('update_text', text);
    }
  });

  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    delete socketToRoom[socket.id];

    if (roomUsers[roomId]) {
      roomUsers[roomId] = roomUsers[roomId].filter(u => u.socketId !== socket.id);
      broadcastUserList(roomId);
      tryDeleteRoomIfEmpty(roomId);
    }
  });

  socket.on('delete_room', (roomId) => {
    if (roomOwners[roomId] === socket.id) {
      io.to(roomId).emit('room_deleted');

      const clients = io.sockets.adapter.rooms.get(roomId);
      if (clients) {
        for (let clientId of clients) {
          const clientSocket = io.sockets.sockets.get(clientId);
          if (clientSocket) {
            clientSocket.leave(roomId);
            delete socketToRoom[clientSocket.id];
          }
        }
      }

      delete roomText[roomId];
      delete roomOwners[roomId];
      delete roomUsers[roomId];
      console.log(`🗑️ Room ${roomId} deleted by ${socket.id}`);
    }
  });

  socket.on('disconnect', () => {
    const roomId = socketToRoom[socket.id];
    delete socketToRoom[socket.id];

    if (roomId && roomUsers[roomId]) {
      roomUsers[roomId] = roomUsers[roomId].filter(u => u.socketId !== socket.id);
      broadcastUserList(roomId);
      tryDeleteRoomIfEmpty(roomId);
    }

    console.log(`🔴 Disconnected: ${socket.id}`);
  });
});

// ✅ Use dynamic port for Render
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
