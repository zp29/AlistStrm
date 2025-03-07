/**
 * AlistStrm 应用入口文件
 * 整合所有服务和控制器
 */
import express from 'express';
import cors from 'cors';
import http from 'http';
import WebSocket from 'ws';
import path from 'path';
import schedule from 'node-schedule';
import { API_CONFIG } from './config/config';
import { setupTelegramBot, sendMessage } from './services/telegramService';
import { generateStrm, getPath, updateTMM, updateEmby } from './controllers/strmController';
import { autoCopyFile } from './services/alistService';

// 创建 Express 应用
const app = express();
app.use(express.json());
app.use(cors());

// 创建 HTTP 服务器
const server = http.createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 设置 WebSocket 连接处理
wss.on('connection', (ws) => {
  console.log('WebSocket 客户端已连接');
  
  ws.on('message', (message) => {
    console.log('收到消息: %s', message);
  });
  
  ws.on('close', () => {
    console.log('WebSocket 客户端已断开连接');
  });
});

// 设置 Telegram Bot
setupTelegramBot();

// 设置路由
// 生成 STRM 文件
app.post('/generateStrm', async (req, res) => {
  await generateStrm(req, res, wss);
});

// 获取 Alist 路径内容
app.post('/getAlistPath', async (req, res) => {
  await getPath(req, res);
});

// 更新 TMM
app.post('/updateTMM', async (req, res) => {
  await updateTMM(req, res, wss);
});

// 更新 Emby
app.post('/updateEmby', async (req, res) => {
  await updateEmby(req, res);
});

// 设置首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 定时任务: 每天凌晨 3 点自动复制文件
const autoCopyJob = schedule.scheduleJob('0 3 * * *', async () => {
  console.log('执行自动复制文件任务', new Date().toLocaleString());
  try {
    await autoCopyFile();
    await sendMessage('自动复制文件任务已完成');
  } catch (error) {
    console.error('自动复制文件任务失败:', error);
    await sendMessage(`自动复制文件任务失败: ${error.message}`);
  }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

// 导出 app 实例 (用于测试)
export default app;
