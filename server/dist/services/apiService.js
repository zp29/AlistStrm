"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyTMM = notifyTMM;
exports.notifyEmby = notifyEmby;
exports.getLinksData = getLinksData;
/**
 * API 服务
 * 处理与 TMM 和 Emby 等外部 API 的交互
 */
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config/config");
const telegramService_1 = require("./telegramService");
/**
 * 通知 TMM 更新
 * @param alistPath - Alist 路径（可选）
 */
async function notifyTMM(alistPath = '') {
    let updateApiPathMov = `${config_1.API_CONFIG.TMM_API_URL}/api/movies`;
    let updateApiPathTv = `${config_1.API_CONFIG.TMM_API_URL}/api/tvshows`;
    console.log(`notifyTMM updateApiPathMov:${updateApiPathMov} updateApiPathTv:${updateApiPathTv}`);
    try {
        let updateResponse, renameResponse, scrapeResponse;
        if ((alistPath === null || alistPath === void 0 ? void 0 : alistPath.includes('mov')) || !alistPath) {
            updateResponse = await axios_1.default.post(updateApiPathMov, { action: 'update', scope: { name: 'all' } }, { headers: { 'api-key': config_1.API_CONFIG.TMM_API_KEY, 'Content-Type': 'application/json' } });
            scrapeResponse = await axios_1.default.post(updateApiPathMov, { action: 'scrape', scope: { name: 'new' } }, { headers: { 'api-key': config_1.API_CONFIG.TMM_API_KEY, 'Content-Type': 'application/json' } });
        }
        if ((alistPath === null || alistPath === void 0 ? void 0 : alistPath.includes('tv')) || !alistPath) {
            updateResponse = await axios_1.default.post(updateApiPathTv, { action: 'update', scope: { name: 'all' } }, { headers: { 'api-key': config_1.API_CONFIG.TMM_API_KEY, 'Content-Type': 'application/json' } });
            scrapeResponse = await axios_1.default.post(updateApiPathTv, { action: 'scrape', scope: { name: 'new' } }, { headers: { 'api-key': config_1.API_CONFIG.TMM_API_KEY, 'Content-Type': 'application/json' } });
        }
        updateResponse = Boolean(updateResponse);
        renameResponse = false; // 不再使用 rename 操作
        scrapeResponse = Boolean(scrapeResponse);
        console.log(`notifyTMM 通知TMM完成 updateResponse:${updateResponse} renameResponse:${renameResponse} scrapeResponse:${scrapeResponse}`);
        // 通知 websocket 客户端（在控制器中实现）
        return { updateResponse, renameResponse, scrapeResponse };
    }
    catch (error) {
        console.error('notifyTMM error:', error);
        return { updateResponse: false, renameResponse: false, scrapeResponse: false };
    }
}
/**
 * 通知 Emby 更新
 * @param embyItemId - Emby 项目 ID（可选）
 */
async function notifyEmby(embyItemId) {
    let response;
    console.log('通知 Emby 更新, embyItemId:', embyItemId);
    try {
        if (embyItemId) {
            console.log(`通知 Emby 更新单个项目: ${config_1.API_CONFIG.EMBY_API_URL}/emby/Items/${embyItemId}/Refresh?api_key=${config_1.API_CONFIG.EMBY_TOKEN}`);
            response = await axios_1.default.post(`${config_1.API_CONFIG.EMBY_API_URL}/emby/Items/${embyItemId}/Refresh?api_key=${config_1.API_CONFIG.EMBY_TOKEN}`, undefined, {
                headers: {
                    'accept': '*/*',
                    'content-type': 'application/x-www-form-urlencoded'
                }
            });
        }
        if (!response || (response.status !== 200 && response.status !== 204)) {
            console.log('更新单个项目失败或未指定项目，准备全部扫描');
            if (telegramService_1.currentChatId)
                telegramService_1.bot.sendMessage(telegramService_1.currentChatId, '通知Emby更新库失败，准备全部扫描');
            response = await axios_1.default.post(`${config_1.API_CONFIG.EMBY_API_URL}/emby/Library/Refresh?api_key=${config_1.API_CONFIG.EMBY_TOKEN}`, undefined, {
                headers: {
                    'accept': '*/*',
                    'content-type': 'application/x-www-form-urlencoded'
                }
            });
        }
        return response.status === 200 || response.status === 204;
    }
    catch (error) {
        console.error('notifyEmby error:', error);
        return false;
    }
}
/**
 * 获取链接数据
 */
async function getLinksData() {
    try {
        // 读取config.json
        const configPath = './config.json';
        if (!fs_1.default.existsSync(configPath)) {
            return {
                status: 'error',
                message: ['配置文件不存在']
            };
        }
        const data = fs_1.default.readFileSync(configPath, 'utf8');
        const config = JSON.parse(data);
        return {
            status: 'success',
            message: [],
            data: config.links
        };
    }
    catch (err) {
        console.error('Error reading config:', err);
        return {
            status: 'error',
            message: ['读取配置文件失败']
        };
    }
}
