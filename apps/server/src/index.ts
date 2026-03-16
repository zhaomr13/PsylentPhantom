import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createSocketServer } from './websocket/server';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// 基础健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 设置 Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

createSocketServer(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
