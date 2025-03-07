"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * AlistStrm 应用入口文件
 * 整合所有服务和控制器
 */
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const path_1 = __importDefault(require("path"));
const node_schedule_1 = __importDefault(require("node-schedule"));
const telegramService_1 = require("./services/telegramService");
const strmController_1 = require("./controllers/strmController");
const alistService_1 = require("./services/alistService");
// 创建 Express 应用
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// 创建 HTTP 服务器
const server = http_1.default.createServer(app);
// 创建 WebSocket 服务器
const wss = new ws_1.default.Server({ server });
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
(0, telegramService_1.setupTelegramBot)();
// 设置路由
// 生成 STRM 文件
app.post('/generateStrm', async (req, res) => {
    await (0, strmController_1.generateStrm)(req, res, wss);
});
// 获取 Alist 路径内容
app.post('/getAlistPath', async (req, res) => {
    await (0, strmController_1.getPath)(req, res);
});
// 更新 TMM
app.post('/updateTMM', async (req, res) => {
    await (0, strmController_1.updateTMM)(req, res, wss);
});
// 更新 Emby
app.post('/updateEmby', async (req, res) => {
    await (0, strmController_1.updateEmby)(req, res);
});
// 设置首页
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
// 静态文件服务
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// 定时任务: 每天凌晨 3 点自动复制文件
const autoCopyJob = node_schedule_1.default.scheduleJob('0 3 * * *', async () => {
    console.log('执行自动复制文件任务', new Date().toLocaleString());
    try {
        await (0, alistService_1.autoCopyFile)();
        await (0, telegramService_1.sendMessage)('自动复制文件任务已完成');
    }
    catch (error) {
        console.error('自动复制文件任务失败:', error);
        await (0, telegramService_1.sendMessage)(`自动复制文件任务失败: ${error.message}`);
    }
});
// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
// 导出 app 实例 (用于测试)
exports.default = app;
