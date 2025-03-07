"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStrm = generateStrm;
exports.getPath = getPath;
exports.updateTMM = updateTMM;
exports.updateEmby = updateEmby;
const ws_1 = __importDefault(require("ws"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config/config");
const alistService_1 = require("../services/alistService");
const fileService_1 = require("../services/fileService");
const apiService_1 = require("../services/apiService");
const telegramService_1 = require("../services/telegramService");
/**
 * 生成 STRM 文件
 */
async function generateStrm(req, res, wss) {
    res.header("Access-Control-Allow-Origin", "*");
    let { alistPath, embyItemId, outputDir = './outputDir', initial = false } = req.body;
    outputDir = config_1.API_CONFIG.OUTPUT_DIR || './outputDir';
    if (!alistPath) {
        res.status(400).send({ status: 'error', message: 'alistPath is required' });
        return;
    }
    console.log('generateStrm alistPath, embyItemId, outputDir -> ', alistPath, embyItemId, outputDir);
    try {
        // 发送开始消息
        wss.clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify({ status: 'start', total: '??' }));
            }
        });
        console.log('generateStrm 更新Alist');
        if (telegramService_1.currentChatId)
            telegramService_1.bot.sendMessage(telegramService_1.currentChatId, `${alistPath} => 开始更新Alist`);
        await (0, alistService_1.updateAlist)(alistPath);
        if (telegramService_1.currentChatId)
            telegramService_1.bot.sendMessage(telegramService_1.currentChatId, `${alistPath} => 更新Alist完成`);
        const { allFiles, newFiles, deletedFiles } = await (0, alistService_1.getVideoFiles)(alistPath, wss);
        console.log(`generateStrm 更新Alist，总共${allFiles.length}个文件，新增${newFiles.length}个文件, 删除${deletedFiles.length}个文件`);
        if (telegramService_1.currentChatId)
            telegramService_1.bot.sendMessage(telegramService_1.currentChatId, `${alistPath} => 总共${allFiles.length}个文件，新增${newFiles.length}个文件，删除${deletedFiles.length}个文件`);
        // 发送更新消息
        wss.clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify({ message: `更新Alist，总共${allFiles.length}个文件，新增${newFiles.length}个文件，删除${deletedFiles.length}个文件` }));
            }
        });
        await (0, fileService_1.clearStrmFile)(newFiles, deletedFiles, outputDir);
        console.log('generateStrm 开始创建Strm');
        let currentPatDiv = {};
        for (let i = 0; i < allFiles.length; i++) {
            const video = allFiles[i];
            // type  2   表示视频文件
            // type  3   表示音频文件
            // type 5,0  表示png文件
            if (video.type !== 2 && video.type !== 3) {
                console.log('generateStrm.js 跳过非视频/音频文件 -> ', video.name);
            }
            else {
                const videoFilePath = path_1.default.join(video.parent, video.name);
                const outputFilePath = path_1.default.join(outputDir, video.parent, `${path_1.default.basename(video.name, path_1.default.extname(video.name))}.strm`);
                // 创建必要的目录
                await (0, fileService_1.createDirRecursively)(path_1.default.dirname(outputFilePath));
                if (video.isMainVideo) {
                    await (0, fileService_1.createStrmFile)(outputFilePath, videoFilePath);
                }
            }
            if (!currentPatDiv.parent) {
                currentPatDiv.parent = video.parent;
                currentPatDiv.length = 0;
            }
            else {
                currentPatDiv.length = (currentPatDiv.length || 0) + 1;
            }
            if (currentPatDiv.parent !== video.parent) {
                if (telegramService_1.currentChatId)
                    telegramService_1.bot.sendMessage(telegramService_1.currentChatId, `${alistPath} => 当前文件夹更新完成 -> ${video.parent} 文件数量：${currentPatDiv.length}`);
                // 发送进度更新当前文件夹更新完成
                wss.clients.forEach(client => {
                    if (client.readyState === ws_1.default.OPEN) {
                        client.send(JSON.stringify({ message: `当前文件夹更新完成 -> ${video.parent} 文件数量：${currentPatDiv.length}` }));
                    }
                });
                currentPatDiv = {
                    parent: video.parent,
                    length: 0
                };
            }
        }
        wss.clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify({ message: `${alistPath} => 共${allFiles.length}个文件，生成STRM完成` }));
            }
        });
        console.log('generateStrm STRM完成', new Date().toLocaleString());
        if (telegramService_1.currentChatId)
            telegramService_1.bot.sendMessage(telegramService_1.currentChatId, `${alistPath} => generateStrm STRM完成${new Date().toLocaleString()}`);
        // 发送完成消息
        wss.clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify({ status: 'done', total: allFiles.length }));
            }
        });
        res.status(200).send('strm files are being generated.');
    }
    catch (error) {
        console.error('Error generating strm files:', error);
        wss.clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify({ status: 'error', message: `error->${error}` }));
            }
        });
        res.status(500).send('Error generating strm files.');
    }
}
/**
 * 获取 Alist 路径内容
 */
async function getPath(req, res) {
    const { path } = req.body;
    const result = await (0, alistService_1.getAlistPath)(path);
    res.status(200).send(result);
}
/**
 * 更新 TMM
 */
async function updateTMM(req, res, wss) {
    res.header("Access-Control-Allow-Origin", "*");
    let { updateResponse, renameResponse, scrapeResponse } = await (0, apiService_1.notifyTMM)();
    // 通知 WebSocket 客户端
    wss.clients.forEach(client => {
        if (client.readyState === ws_1.default.OPEN) {
            client.send(JSON.stringify({
                message: `通知TMM完成 updateResponse:${updateResponse} renameResponse:${renameResponse} scrapeResponse:${scrapeResponse}`
            }));
        }
    });
    res.status(200).send({
        updateResponse,
        renameResponse,
        scrapeResponse
    });
}
/**
 * 更新 Emby
 */
async function updateEmby(req, res) {
    res.header("Access-Control-Allow-Origin", "*");
    let notifyEmbyState = await (0, apiService_1.notifyEmby)();
    res.status(200).send({ status: notifyEmbyState ? 'success' : 'error' });
}
