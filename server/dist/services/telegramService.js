"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentChatId = exports.bot = void 0;
exports.initTelegramBot = initTelegramBot;
exports.setupTelegramBot = setupTelegramBot;
exports.sendMessage = sendMessage;
/**
 * Telegram Bot 服务
 * 处理所有与 Telegram 机器人相关的功能
 */
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const config_1 = require("../config/config");
const axios_1 = __importDefault(require("axios"));
const config_2 = require("../config/config");
// 创建 Telegram Bot 实例
const bot = new node_telegram_bot_api_1.default(config_1.TELEGRAM_CONFIG.TOKEN, { polling: true });
exports.bot = bot;
// 全局状态存储
const songIdToUrl = {}; // 存储歌曲ID和URL的映射
const userStates = {}; // 用户状态存储
let currentChatId = null;
exports.currentChatId = currentChatId;
/**
 * 处理音乐搜索模式
 * @param chatId - 用户的聊天ID
 * @param query - 搜索关键词
 */
function handleSearchMode(chatId, query) {
    if (!query || query === '/cancel' || query === '/searchmp3') {
        bot.sendMessage(chatId, '取消搜索');
        delete userStates[chatId];
        return;
    }
    bot.sendMessage(chatId, `开始搜索音乐：${query}`);
    getMusicList(query);
    // 清除用户状态
    delete userStates[chatId];
}
/**
 * 发送CMS选择菜单
 * @param chatId - 用户的聊天ID
 */
function sendCmsMenu(chatId) {
    bot.sendMessage(chatId, '请选择 CMS 服务：', {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'CMS1', callback_data: 'cms1' },
                    { text: 'CMS2', callback_data: 'cms2' }
                ]
            ]
        }
    });
}
/**
 * 启动音乐搜索模式
 * @param chatId - 用户的聊天ID
 */
function startMusicSearch(chatId) {
    bot.sendMessage(chatId, '请输入你想搜索的音乐名称：');
    // 设置状态，让后续的消息都被当作搜索内容
    userStates[chatId] = { action: 'searching' };
}
/**
 * 获取音乐列表
 * @param query - 搜索关键词
 */
async function getMusicList(query) {
    try {
        const response = await axios_1.default.get(`${config_2.MUSIC_API.URL}?keyword=${query}`, {
            headers: {
                'If-None-Match': 'W/"d0c-0BtK0ERx1+vOTq10o1wv/VANNg4"',
                'mk': 'melody',
                'Accept': '*/*',
                'Accept-Language': 'zh,zh-CN;q=0.9',
                'Proxy-Connection': 'keep-alive',
                'Cache-Control': 'no-cache', // 禁用缓存
                'Pragma': 'no-cache' // 强制不使用缓存
            },
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) // 用来忽略SSL证书错误
        });
        const songs = response.data.data.songs;
        // 构建返回的音乐列表
        const musicList = songs.map((song) => {
            let songName = song.songName.length > 9 ? song.songName.substring(0, 9) + '...' : song.songName;
            let artist = song.artist.length > 9 ? song.artist.substring(0, 9) + '...' : song.artist;
            return {
                // song.songName 保留9个字符
                text: `${song.source} - ${songName} - ${artist}`,
                url: song.url
            };
        });
        // 如果没有结果，返回一个默认消息
        if (musicList.length === 0 || musicList[0].text === '未找到相关音乐') {
            if (currentChatId)
                bot.sendMessage(currentChatId, '未找到相关音乐');
            return [];
        }
        // 构建键盘
        const inlineKeyboard = [];
        musicList.forEach((song, index) => {
            const songId = `song_${index}`; // 生成唯一的ID
            songIdToUrl[songId] = song.url; // 存储ID和URL的映射
            inlineKeyboard.push([{
                    text: song.text,
                    callback_data: songId // 使用ID作为callback_data
                }]);
        });
        // 发送可点击的列表
        if (currentChatId) {
            bot.sendMessage(currentChatId, '请选择一首歌曲：', {
                reply_markup: {
                    inline_keyboard: inlineKeyboard
                }
            });
        }
        return musicList;
    }
    catch (error) {
        console.error('getMusicList 错误:', error);
        return [{ text: '未找到相关音乐', url: '' }];
    }
}
/**
 * 下载音乐
 * @param url - 音乐URL
 * @param query - 回调查询
 */
async function downloadMusic(url, query) {
    try {
        // 通知用户正在下载
        if (currentChatId) {
            bot.sendMessage(currentChatId, '正在下载音乐，请稍候...');
        }
        // 下载音乐文件
        const response = await (0, axios_1.default)({
            method: 'get',
            url,
            responseType: 'arraybuffer'
        });
        // 从 URL 提取文件名
        const urlObj = new URL(url);
        const filename = urlObj.pathname.split('/').pop() || 'music.mp3';
        // 发送音频文件
        if (currentChatId) {
            bot.sendAudio(currentChatId, Buffer.from(response.data));
        }
        // 标记消息已处理
        bot.answerCallbackQuery(query.id);
    }
    catch (error) {
        console.error('下载音乐失败:', error);
        if (currentChatId) {
            bot.sendMessage(currentChatId, '下载音乐失败，请稍后再试');
        }
        bot.answerCallbackQuery(query.id, { text: '下载失败' });
    }
}
/**
 * CMS 更新
 * @param cmsUrl - CMS服务URL
 */
async function CMSUpdate(cmsUrl) {
    // 发送增量同步请求
    try {
        const response = await axios_1.default.get(cmsUrl);
        if (currentChatId) {
            bot.sendMessage(currentChatId, `CMS 同步状态: ${response.status === 200 ? '成功' : '失败'}`);
        }
    }
    catch (error) {
        console.error('CMS 同步失败:', error);
        if (currentChatId) {
            bot.sendMessage(currentChatId, 'CMS 同步失败，请稍后再试');
        }
    }
}
// 初始化 Telegram Bot
function initTelegramBot(autoGenerateStrm, clearVideoFilesCache) {
    /**
     * 处理消息事件
     */
    bot.on('message', async (msg) => {
        var _a;
        const chatId = msg.chat.id;
        const messageText = msg.text || '';
        const username = ((_a = msg.from) === null || _a === void 0 ? void 0 : _a.username) || '';
        // 权限验证
        if (username !== config_1.TELEGRAM_CONFIG.AUTHORIZED_USERNAME) {
            bot.sendMessage(chatId, '你没有权限使用此机器人');
            return;
        }
        exports.currentChatId = currentChatId = chatId;
        // 处理特殊状态：搜索模式
        if (userStates[chatId] && userStates[chatId].action === 'searching') {
            handleSearchMode(chatId, messageText);
            return;
        }
        // 根据指令处理不同功能
        switch (messageText) {
            case '/cmsupdate':
                // 发送CMS选择菜单
                sendCmsMenu(chatId);
                break;
            case '/searchmp3':
                // 进入音乐搜索模式
                startMusicSearch(chatId);
                break;
            case '/automov':
            case '/autotv':
            case '/autoami':
                // 指定类型的同步
                bot.sendMessage(currentChatId, '开始同步strm');
                autoGenerateStrm(messageText);
                break;
            case '/updatestrm':
                // 更新所有strm文件
                bot.sendMessage(currentChatId, '开始同步strm');
                autoGenerateStrm();
                break;
            case '/clearstrm':
                // 清除strm缓存
                clearVideoFilesCache();
                bot.sendMessage(currentChatId, 'strm缓存已清除');
                break;
            case '/resetstrm':
                // 重置并重新生成strm
                bot.sendMessage(currentChatId, '开始重置strm');
                clearVideoFilesCache();
                autoGenerateStrm();
                break;
            default:
                // 未知命令
                bot.sendMessage(currentChatId, '收到消息，但不是有效命令');
        }
    });
    /**
     * 处理按钮点击事件
     */
    bot.on('callback_query', (query) => {
        var _a, _b;
        const callbackData = query.data || '';
        const songId = callbackData; // 获取按钮的callback_data（即歌曲的ID）
        // 检查按钮回调权限
        if (currentChatId !== ((_a = query.message) === null || _a === void 0 ? void 0 : _a.chat.id)) {
            bot.sendMessage(((_b = query.message) === null || _b === void 0 ? void 0 : _b.chat.id) || 0, '你没有权限');
            return;
        }
        // 根据用户选择选择对应的 CMS 服务 URL
        if (callbackData === 'cms1' || callbackData === 'cms2') {
            let cmsUrl = '';
            if (callbackData === 'cms1') {
                cmsUrl = 'http://cms.zp29.net:29/api/sync/lift';
            }
            else {
                cmsUrl = 'http://cms.zp29.net:29/api/sync/lift';
            }
            if (currentChatId) {
                bot.sendMessage(currentChatId, `正在向 ${callbackData} 服务发送增量同步请求...`);
            }
            // 删除原始的选择消息
            if (query.message) {
                bot.deleteMessage(query.message.chat.id, query.message.message_id)
                    .catch(err => console.log('Error deleting message:', err));
            }
            CMSUpdate(cmsUrl);
            return;
        }
        // 查找对应的URL
        const url = songIdToUrl[songId];
        // 处理音乐下载
        if (url) {
            // 将 URL 发送给用户
            if (currentChatId) {
                bot.sendMessage(currentChatId, `你选择的歌曲链接是：\n${url}`);
            }
            downloadMusic(url, query);
        }
        else {
            if (currentChatId) {
                bot.sendMessage(currentChatId, '无法获取歌曲链接，请稍后再试。');
            }
        }
    });
    console.log('Telegram Bot 初始化完成');
}
/**
 * 设置 Telegram Bot
 * 初始化机器人并设置消息处理函数
 */
function setupTelegramBot() {
    // 创建自动生成 STRM 的函数，这将在 app.ts 中调用
    const autoGenerateStrm = async (command) => {
        // 这里将会从控制器调用相应的函数
        console.log(`自动生成 STRM 文件，命令: ${command || 'all'}`);
        try {
            // 根据不同命令生成不同类型的 STRM 文件
            let alistPath = '';
            if (command === '/automov') {
                alistPath = '/pan/115/mov';
            }
            else if (command === '/autotv') {
                alistPath = '/pan/115/tv';
            }
            else if (command === '/autoami') {
                alistPath = '/pan/115/sth';
            }
            else {
                // 生成所有类型
                const paths = [
                    '/pan/115/mov',
                    '/pan/115/tv',
                    '/pan/115/sth'
                ];
                for (const path of paths) {
                    // 这里会调用实际的 generateStrm 函数，但在此处我们只是模拟
                    console.log(`生成 STRM 文件: ${path}`);
                    // 实际实现将在控制器中完成
                }
                return;
            }
            console.log(`生成 STRM 文件: ${alistPath}`);
            // 实际实现将在控制器中完成
        }
        catch (error) {
            console.error('自动生成 STRM 文件失败:', error);
            if (currentChatId) {
                bot.sendMessage(currentChatId, `生成 STRM 文件失败: ${error.message}`);
            }
        }
    };
    // 使用之前定义的 initTelegramBot 函数初始化机器人
    initTelegramBot(autoGenerateStrm, () => {
        // 清除视频文件缓存的函数
        console.log('清除视频文件缓存');
        // 实际实现将调用 alistService 中的函数
    });
}
/**
 * 发送消息到当前聊天
 * @param message - 要发送的消息
 */
async function sendMessage(message) {
    if (currentChatId) {
        try {
            await bot.sendMessage(currentChatId, message);
        }
        catch (error) {
            console.error('发送消息失败:', error);
        }
    }
    else {
        console.warn('没有活跃的聊天 ID，无法发送消息');
    }
}
