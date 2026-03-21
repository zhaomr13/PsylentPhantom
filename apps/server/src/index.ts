import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createSocketServer } from './websocket/server';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// 基础健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 静态文件服务 - 前端构建产物
const webPath = process.env.WEB_PATH || path.join(__dirname, '../../web');
app.use(express.static(webPath));

// 设置 Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false,
  },
  transports: ['websocket', 'polling'],
});

createSocketServer(io);

// SPA 路由 - 所有非 API 路由返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(webPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
