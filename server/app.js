const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const WebSocket = require('ws');
const cors = require('cors');
const schedule = require('node-schedule');
const TelegramBot = require('node-telegram-bot-api');

// Telegram Bot 配置
const token = '7580922585:AAEg6t5WsExm86x5jiIygH-dqOnvPy5JuwA';
const bot = new TelegramBot(token, { polling: true });

// Express 应用配置
const app = express();
app.use(express.json());
app.use(cors());

// 全局状态存储
const songIdToUrl = {}; // 存储歌曲ID和URL的映射
const userStates = {}; // 用户状态存储

/**
 * Telegram Bot 消息处理
 * 负责处理所有来自用户的指令和交互
 */
let currentChatId = null;
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    const username = msg.from.username;
    
    // 权限验证
    if (username !== 'aliensrt29') {
        bot.sendMessage(chatId, '你没有权限使用此机器人');
        return;
    }
    
    currentChatId = chatId;
    
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
 * 处理音乐搜索模式
 * @param {number} chatId - 用户的聊天ID
 * @param {string} query - 搜索关键词
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
 * @param {number} chatId - 用户的聊天ID
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
 * @param {number} chatId - 用户的聊天ID
 */
function startMusicSearch(chatId) {
    bot.sendMessage(chatId, '请输入你想搜索的音乐名称：');
    // 设置状态，让后续的消息都被当作搜索内容
    userStates[chatId] = { action: 'searching' };
}



// API 配置信息
const Server_Host = process.env.Server_Host || 'http://openwrt.zp29.net';
const TMM_API_KEY = process.env.TMM_API_KEY || 'f8ea228e-2caf-48b0-9aae-7501f8a34568';
const EMBY_TOKEN = process.env.EMBY_TOKEN || '6dbc93c10273476fafe2dd92ca7f678c';
const ALIST_TOKEN = process.env.ALIST_TOKEN || 'alist-1c1478bf-93dd-4c07-b1cc-062a51596c03o9LdU8xedrhIumaf7MTDHfh7e8gk7lQFQcYcxro4nShuE3Q3H5wpGTYG8LnoqzpN';

// API URL 配置
const EMBY_API_URL = process.env.EMBY_API_URL || 'http://emby.zp29.net:8096';
const ALIST_API_URL = process.env.ALIST_API_URL || 'http://alist.zp29.net:5344';
const TMM_API_URL = process.env.TMM_API_URL || `${Server_Host}:7878`;

const outputDir_path = process.env.outputDir

console.log('API配置: Server_Host =', Server_Host)
console.log('前端地址: http://127.0.0.1:8080')
console.log('后端地址: http://127.0.0.1:3000')

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const wss = new WebSocket.Server({ port: 18095, host: '0.0.0.0' });
wss.on('open', () => {
    console.log('WebSocket connection established');
    wss.send('Hello, server!');
});

wss.on('message', (message) => {
    console.log('Received:', message);
});

app.post('/updateTMM', async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");

    let { updateResponse, renameResponse, scrapeResponse } = await notifyTMM()
    res.status(200).send({
        updateResponse,
        renameResponse,
        scrapeResponse
    });
})
app.post('/updateEmby', async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");

    let notifyEmbyState = await notifyEmby()
    res.status(200).send({ status: notifyEmbyState ? 'success' : 'error' });
})


async function getMusicList(query) {

    

    try {

        const response = await axios.get(`http://music.zp29.net:29/api/songs?keyword=${query}`, {
            headers: {
                'If-None-Match': 'W/"d0c-0BtK0ERx1+vOTq10o1wv/VANNg4"', 
                'mk': 'melody',
                'Accept': '*/*',
                'Accept-Language': 'zh,zh-CN;q=0.9',
                'Proxy-Connection': 'keep-alive',
                'Cache-Control': 'no-cache',  // 禁用缓存
                'Pragma': 'no-cache'  // 强制不使用缓存
            },
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })  // 用来忽略SSL证书错误
        })

        const songs = response.data.data.songs;

        // 构建返回的音乐列表
        const musicList = songs.map(song => {
            let songName = song.songName.length > 9 ? song.songName.substring(0, 9) + '...' : song.songName;
            let artist = song.artist.length > 9 ? song.artist.substring(0, 9) + '...' : song.artist;
            return ({
                // song.songName 保留9个字符
                text: `${song.source} - ${songName} - ${artist}`,
                url: song.url
            })
        });  

        // 如果没有结果，返回一个默认消息
        if (musicList[0].text === '未找到相关音乐') {
            bot.sendMessage(currentChatId, musicList[0].text);
            return;
        }

        // 构建键盘
        const inlineKeyboard = [];
        musicList.map((song, index) => {
            
            const songId = `song_${index}`; // 生成唯一的ID
            songIdToUrl[songId] = song.url; // 存储ID和URL的映射
            inlineKeyboard.push([{
                text: song.text,            
                callback_data: songId // 使用ID作为callback_data
            }]);
        });

        // 发送可点击的列表
        bot.sendMessage(currentChatId, '请选择一首歌曲：', {
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        });

    } catch (error) {

        console.error('getMusicList 错误:', error)

        return [{ text: '未找到相关音乐', url: '' }];
    }
}

// 处理按钮点击事件
bot.on('callback_query', (query) => {
    const callbackData = query.data;
    const songId = query.data;  // 获取按钮的callback_data（即歌曲的ID）

    // 检查按钮回调权限
if(currentChatId != query.message.chat.id){
        bot.sendMessage(query.message.chat.id, '你没有权限');
        return  
    }


    // 根据用户选择选择对应的 CMS 服务 URL
    if (callbackData === 'cms1' || callbackData === 'cms2') {
        let cmsUrl = '';
        if (callbackData === 'cms1') {
            cmsUrl = 'http://cms.zp29.net:29/api/sync/lift';
        } else if (callbackData === 'cms2') {
            cmsUrl = 'http://cms.zp29.net:29/api/sync/lift';
        }
        bot.sendMessage(currentChatId, `正在向 ${callbackData === 'cms1' ? 'cms1' : 'cms2'} 服务发送增量同步请求...`);
        // 删除原始的选择消息
        bot.deleteMessage(currentChatId, query.message.message_id)
            .catch(err => console.log('Error deleting message:', err));
        CMSUpdate(cmsUrl);
        return
    }


    // 查找对应的URL
const url = songIdToUrl[songId];

    // 处理 Telegram 回答

    if (url) {
        // 将 URL 发送给用户
        bot.sendMessage(currentChatId, `你选择的歌曲链接是：\n${url}`);
        downloadMusic(url, query);
    } else {
        bot.sendMessage(currentChatId, '无法获取歌曲链接，请稍后再试。');
    }
});

async function CMSUpdate(cmsUrl) {
    // 发送增量同步请求
    try {
        const response = await axios.get(cmsUrl, {}, {
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWQiOjEsImV4cCI6MTczNzk3MTA1N30.eaG9cdMEuV30yy2miOxmYXte47Km_UKk1iIoXz6oFKA',
                'Proxy-Connection': 'keep-alive',
            }
        });

        // 根据响应返回状态
        if (response.status === 200 && response.data.status === 0) {
            bot.sendMessage(currentChatId, `增量同步请求已成功发送到 ${callbackData === 'cms1' ? 'cms1' : 'cms2'} 服务！`);
        } else {
            bot.sendMessage(currentChatId, `请求失败，状态：${response.data.status}`);
        }
    } catch (error) {
        console.log('Error in CMS request:', error);
        bot.sendMessage(currentChatId, '请求发生错误，请稍后再试。');
    }
}

// 发送请求启动下载任务
async function downloadMusic(url, query) {
    try {
        // 第一步：启动下载任务
        const response = await axios.post('http://music.zp29.net:29/api/sync-jobs', {
            jobType: "DownloadSongFromUrl",
            urlJob: {
                url: url,
                meta: {
                    songId: ""
                }
            }
        }, {
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'zh,zh-CN;q=0.9',
                'Content-Type': 'application/json',
                'Origin': 'http://music.zp29.net:29',
                'Proxy-Connection': 'keep-alive',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'mk': 'melody'
            },
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) // 忽略 SSL 证书
        });

        if (response.data.status === 0) {
            const jobId = response.data.data.jobId; // 获取 jobId

            // 第二步：查询下载状态，直到下载完成
            const interval = setInterval(async () => {
                const statusResponse = await axios.get(`http://music.zp29.net:29/api/sync-jobs/${jobId}`, {
                    headers: {
                        'Accept': '*/*',
                        'Accept-Language': 'zh,zh-CN;q=0.9',
                        'Proxy-Connection': 'keep-alive',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                        'mk': 'melody'
                    },
                    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) // 忽略 SSL 证书
                });

                const jobStatus = statusResponse.data.data.jobs;
                const progress = jobStatus.progress; // 下载进度
                const status = jobStatus.status; // 当前状态
                const tip = jobStatus.tip; // 提示信息

                // 向用户发送下载进度信息
                bot.answerCallbackQuery(query.id, { text: `任务状态：${status}\n进度：${progress}%` });
                // bot.sendMessage(currentChatId, `任务状态：${status}\n进度：${progress}%\n提示：${tip}`);

                // 如果任务完成或出错，则停止查询
                if (status === "已完成" || status === "失败" || status === "已取消") {
                    clearInterval(interval);
                    bot.answerCallbackQuery(query.id, { text: `任务状态：${status}`, show_alert: true });
                    bot.sendMessage(currentChatId, `下载完成！\n任务状态：${status}`);
                    notifyEmby(43960)
                }
            }, 5000); // 每5秒查询一次任务状态

        } else {
            bot.answerCallbackQuery(query.id, { text: '启动下载任务失败，请稍后重试。', show_alert: true });
            bot.sendMessage(currentChatId, "启动下载任务失败，请稍后重试。");
        }
    } catch (error) {
        console.log('下载任务请求失败:', error);
        bot.answerCallbackQuery(query.id, { text: '请求失败，请稍后再试。', show_alert: true });
        bot.sendMessage(currentChatId, "请求失败，请稍后再试。");
    }
}
  
  

// 抽离的 getLinks 方法
async function getLinksData() {
    const jsonPath = '../links.json';
    try {
        const data = await fs.promises.readFile(jsonPath, 'utf8');
        const configArray = JSON.parse(data);
        return {
            status: 'success',
            data: configArray
        };
    } catch (err) {
        console.error('Error reading config:', err);
        return {
            status: 'error',
            message: []
        };
    }
}

// 修改原有的路由处理
app.post('/getLinks', async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    const result = await getLinksData();
    res.status(200).send(result);
});

// 添加定时任务
schedule.scheduleJob('0 3,11,18,21 * * *', async () => {
    console.log('执行每日3,11,18,21点的 getLinks 任务');
    currentChatId && bot.sendMessage(currentChatId, '执行每日3,11,18,21点的 getLinks 任务');
    try {
        // await autoCopyFile();
        await autoGenerateStrm();
    } catch (error) {
        console.error('定时任务执行失败:', error);
        currentChatId && bot.sendMessage(currentChatId, '定时任务执行失败');
    }
});
// autoGenerateStrm();

// autoCopyFile 函数现在被 autoGenerateStrm 调用
async function autoCopyFile() {
    // pan/115/Video/mov1 to pan/115/mov
    await CopyFn('/pan/115/Video/mov1', '/pan/115/mov')
    // pan/115/Video/tv1 to pan/115/tv
    await CopyFn('/pan/115/Video/tv1', '/pan/115/tv')
    // pan/115/Video/ami1 to pan/115/sth
    await CopyFn('/pan/115/Video/ami1', '/pan/115/sth')

    async function CopyFn(path1, path2) {
        /**{
            "src_dir": "string",
            "dst_dir": "string",
            "names": [
                "string"
            ]
        }*/
        let names = [];
        const listUrl = `${ALIST_API_URL}/api/fs/list`;
        const listResponse = await axios.post(listUrl, { path: path1, refresh: true }, {
            headers: {
                'Authorization': ALIST_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        // console.log('app.js listResponse.data.data -> ', listResponse?.data?.data?.content)
        if (listResponse?.data?.data?.content) {
            names = listResponse?.data?.data?.content.map(item => item.name);
        }
        console.log(`names -> ${JSON.stringify(names)}`)
        if (!names.length) {
            return;
        }
        const copyUrl = `${ALIST_API_URL}/api/fs/move`;
        const copyResponse = await axios.post(copyUrl, { src_dir: path1, dst_dir: path2, names }, {
            headers: {
                'Authorization': ALIST_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        console.log(`copyResponse -> `, copyResponse.data)
    }

}
async function autoGenerateStrm(autoName = '') {
    autoName = autoName.replace('/', '');
    const result = await getLinksData();
    if(!result?.data) {
        console.log('定时获取 autoList 结果: 无数据');
        return
    }
    console.log('app.js result?.data -> ', result?.data, autoName)
    let autoList = result?.data?.filter(item => item.auto);
    if (autoName) {
        autoList = autoList.filter(item => item.name.toLocaleLowerCase() == autoName.toLocaleLowerCase());
    }
    for (const item of autoList) {
        // api generateStrm
        axios.post(`http://127.0.0.1:3000/generateStrm`, {
            alistPath: item.path,
            initial: true
        });
    }
    console.log('定时获取 autoList 结果:', autoList);
}


/**
 * 生成strm文件的接口
 * @param {string} alistPath - 要扫描的Alist路径
 * @param {string} outputDir - 输出strm文件的目录
 */
app.post('/generateStrm', async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    let { alistPath, embyItemId, outputDir = './outputDir', initial = false } = req.body;

    outputDir = outputDir_path ?? './outputDir'

    if (!alistPath) {
        res.send({ status: 'error', message: 'alistPath is required' });
        return
    }

    console.log('generateStrm alistPath, embyItemId, outputDir -> ', alistPath, embyItemId, outputDir)

    try {

        // 发送开始消息
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ status: 'start', total: '??' }));
            }
        });

        console.log('generateStrm 更新Alist')
        if (currentChatId) bot.sendMessage(currentChatId, `${alistPath} => 开始更新Alist`);
        await updateAlist(alistPath);
        if (currentChatId) bot.sendMessage(currentChatId, `${alistPath} => 更新Alist完成`);

        const { allFiles, newFiles, deletedFiles } = await getVideoFiles(alistPath);
        console.log(`generateStrm 更新Alist，总共${allFiles.length}个文件，新增${newFiles.length}个文件, 删除${deletedFiles.length}个文件`);
        if (currentChatId) bot.sendMessage(currentChatId, `${alistPath} => 总共${allFiles.length}个文件，新增${newFiles.length}个文件，删除${deletedFiles.length}个文件`);

        // 发送开始消息
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ message: `更新Alist，总共${allFiles.length}个文件，新增${newFiles.length}个文件，删除${deletedFiles.length}个文件` }));
            }
        });

        // if (initial) {
        await clearStrmFile(newFiles, deletedFiles, outputDir);
        // }

        console.log('generateStrm 开始创建Strm')
        let currentPatDiv = {}
        for (let i = 0; i < allFiles.length; i++) {
            const video = allFiles[i];

            // type  2   表示视频文件
            // type  3   表示音频文件
            // type 5,0  表示png文件
            if (video.type !== 2 && video.type !== 3) {
                console.log('generateStrm.js 跳过非视频/音频文件 -> ', video.name);
            } else {
                const videoFilePath = path.join(video.parent, video.name);
                const outputFilePath = path.join(outputDir, video.parent, `${path.basename(video.name, path.extname(video.name))}.strm`);

                // 创建必要的目录
                await createDirRecursively(path.dirname(outputFilePath));



                if (video.isMainVideo) {
                    await createStrmFile(outputFilePath, videoFilePath);
                }
            }

            if (!currentPatDiv.path) {
                currentPatDiv.parent = video.parent
                currentPatDiv.length = 0
            } else {
                currentPatDiv.length += 1
            }

            if (currentPatDiv.parent !== video.parent) {
                if (currentChatId) bot.sendMessage(currentChatId, `${alistPath} => 当前文件夹更新完成 -> ${video.parent} 文件数量：${currentPatDiv.length}`);
                // 发送进度更新当前文件夹更新完成
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ message: `当前文件夹更新完成 -> ${video.parent} 文件数量：${currentPatDiv.length}` }));
                    }
                });
                currentPatDiv = {
                    parent: video.parent,
                    length: 0
                }
            }

        }

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ message: `${alistPath} => 共${allFiles.length}个文件，生成Strmp完成` }));
            }
        });
        console.log('generateStrm Strmp完成', new Date().toLocaleString())
        if (currentChatId) bot.sendMessage(currentChatId, `${alistPath} => geneaateStrm Strmp完成${new Date().toLocaleString()}`);

        // 使用POST接口调用通知TMM和Emby，而不是在这里直接调用

        // 发送完成消息
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ status: 'done', total: allFiles.length }));
            }
        });
        res.status(200).send('strm and nfo files are being generated.');

    } catch (error) {
        console.error('Error generating strm and nfo files:', error.message);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ status: 'error', message: `error->${error}` }));
            }
        });
        res.status(500).send('Error generating strm and nfo files.');
    }
})

app.post('/getAlistPath', async (req, res) => {
    const { path } = req.body;
    const result = await getAlistPath(path);
    res.status(200).send(result);
});

async function getAlistPath(path = '') {
    const apiUrl = `${ALIST_API_URL}/api/fs/list`

    console.log(`getAlistPath apiUrl -> ${apiUrl} path -> ${path}`)

    const response = await axios.post(apiUrl, { path }, {
        headers: {
            'Authorization': ALIST_TOKEN,
            'Content-Type': 'application/json'
        }
    })
    return response?.data?.data?.content || []
}

// 新增一个用于存储视频文件列表的JSON文件路径
const VIDEO_FILES_CACHE = './videoFiles.json';

/**
 * 读取缓存的视频文件列表
 */
async function readCachedVideoFiles() {
    try {
        if (!fs.existsSync(VIDEO_FILES_CACHE)) {
            return {};
        }
        const data = await fs.promises.readFile(VIDEO_FILES_CACHE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取视频文件缓存失败:', error);
        return {};
    }
}

/**
 * 保存视频文件列表到缓存
 */
async function saveVideoFilesCache(path, files) {
    try {
        const cache = await readCachedVideoFiles();
        cache[path] = {
            timestamp: Date.now(),
            files: files
        };
        await fs.promises.writeFile(VIDEO_FILES_CACHE, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
        console.error('保存视频文件缓存失败:', error);
    }
}

/**
 * 清空视频文件缓存
 */
async function clearVideoFilesCache() {
    try {
        await fs.promises.unlink(VIDEO_FILES_CACHE);
    } catch (error) {
        console.error('清空视频文件缓存失败:', error);
    }
}

/**
 * 找到文件夹下的所有视频文件
 * @param {string} path - 文件夹路径
 * @returns {Promise<{allFiles: Array, newFiles: Array}>}
 */
async function getVideoFiles(alistPath) {
    try {
        const apiUrl = `${ALIST_API_URL}/api/fs/list`;
        let refreshArr = [];
        let videoFiles = [];

        // 读取缓存的文件列表
        const cache = await readCachedVideoFiles();
        const cachedFiles = cache[alistPath]?.files || [];

        async function fetchFiles(path) {
            let refresh = !refreshArr.includes(path);
            const response = await axios.post(apiUrl, { path, refresh }, {
                headers: {
                    'Authorization': ALIST_TOKEN,
                    'Content-Type': 'application/json'
                }
            });

            refreshArr.push(path);
            refreshArr = [...new Set(refreshArr)];

            const items = response?.data?.data?.content || [];
            const total = response?.data?.data?.total || 0;
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ message: `${refresh} => ${path} -> 文件夹下的文件数量：${items.length} 文件夹数量：${total}` }));
                }
            });

            for (const item of items) {
                const fullPath = path + '/' + item.name;

                if (item.is_dir) {
                    await fetchFiles(fullPath);
                } else if (item.type === 2 || item.type === 3 || item.type === 5 || item.type === 0) {
                    // type  2   表示视频文件
                    // type  3   表示音频文件
                    // type 5,0  表示png文件
                    videoFiles.push({
                        parent: path,
                        parentSize: total,
                        name: item.name,
                        is_dir: false,
                        size: item.size,
                        type: item.type,
                        fullPath: fullPath // 添加完整路径用于对比
                    });
                }
            }
        }

        await fetchFiles(alistPath);

        // 处理视频文件大小判断
        videoFiles = videoFiles.map(item => {
            let videoMinSIZE = item?.parent?.includes('jav') ? 100 : 10;
            item.isMainVideo = item.size > 1024 * 1024 * videoMinSIZE;
            if (item.type === 3) {
                item.isMainVideo = true;
            }
            return item;
        });

        // 找出新增的文件
        const newFiles = videoFiles.filter(newFile => {
            if (cachedFiles.length === 0) {
                return true;
            }
            return !cachedFiles.some(cachedFile =>
                cachedFile.fullPath === newFile.fullPath &&
                cachedFile.size === newFile.size
            );
        });

        //找出删除的文件
        const deletedFiles = cachedFiles.filter(cachedFile => {
            return !videoFiles.some(newFile =>
                newFile.fullPath === cachedFile.fullPath &&
                newFile.size === cachedFile.size
            );
        });

        // 保存新的文件列表到缓存
        await saveVideoFilesCache(alistPath, videoFiles);

        return {
            allFiles: videoFiles,
            newFiles: newFiles,
            deletedFiles: deletedFiles,
        };

    } catch (error) {
        console.error('获取视频文件列表失败:', error);
        return {
            allFiles: [],
            newFiles: [],
            deletedFiles: [],
        };
    }
}


// 清空strm文件
const clearStrmFile = async (newFiles, deletedFiles, outputDir) => {
    try {
        // 读取现有的 videoFiles.json
        let videoFilesData = {};
        const videoFilesPath = path.join(__dirname, 'videoFiles.json');
        if (fs.existsSync(videoFilesPath)) {
            const data = await fs.promises.readFile(videoFilesPath, 'utf8');
            videoFilesData = JSON.parse(data);
        }

        // 处理需要删除的文件
        for (const file of deletedFiles) {
            const strmPath = path.join(
                outputDir,
                file.parent,
                `${path.basename(file.name, path.extname(file.name))}.strm`
            );

            // 只删除 .strm 文件
            if (fs.existsSync(strmPath)) {
                await fs.promises.unlink(strmPath);
                console.log(`已删除STRM文件: ${strmPath}`);

                // 从 videoFiles.json 中移除记录
                const key = path.join(file.parent, file.name);
                delete videoFilesData[key];
            }
        }

        // 更新 newFiles 到 videoFiles.json
        for (const file of newFiles) {
            const key = path.join(file.parent, file.name);
            videoFilesData[key] = {
                parent: file.parent,
                name: file.name,
                type: file.type,
                isMainVideo: file.isMainVideo,
                updatedAt: new Date().toISOString()
            };
        }

        // 保存更新后的 videoFiles.json
        await fs.promises.writeFile(
            videoFilesPath,
            JSON.stringify(videoFilesData, null, 2),
            'utf8'
        );
        console.log('videoFiles.json 更新成功');

        // 清理空目录
        await cleanEmptyDirectories(outputDir);

    } catch (error) {
        console.error('清理STRM文件时出错:', error);
        throw error;
    }
};

// 递归清理空目录的辅助函数
const cleanEmptyDirectories = async (directory) => {
    try {
        const files = await fs.promises.readdir(directory);

        for (const file of files) {
            const fullPath = path.join(directory, file);
            const stat = await fs.promises.stat(fullPath);

            if (stat.isDirectory()) {
                await cleanEmptyDirectories(fullPath);

                // 再次检查目录是否为空
                const afterFiles = await fs.promises.readdir(fullPath);
                if (afterFiles.length === 0) {
                    await fs.promises.rmdir(fullPath);
                    // console.log(`删除空目录: ${fullPath}`);
                }
            }
        }
    } catch (error) {
        console.error('清理空目录时出错:', error);
    }
};

// 创建目录
async function createDirRecursively(dir) {
    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
    }
}


// 生成strm文件
async function createStrmFile(outputPath, videoFilePath) {
    // 检查strm文件是否已存在
    if (fs.existsSync(outputPath)) {
        console.log(`STRM文件已存在，跳过创建: ${outputPath}`);
        return;
    }

    const strmContent = ALIST_API_URL + '/d' + videoFilePath;
    await fs.promises.writeFile(outputPath, strmContent);
}


// 电影信息相关函数已移除，不再使用 OMDB/TMDB API

// 更新alist目录
async function updateAlist(alistPath) {
    var data = JSON.stringify({
        "path": alistPath,
        "password": "",
        "page": 1,
        "per_page": 1000,
        "refresh": true
    });
    console.log('generateStrm.js updateAlist alistPath -> ', alistPath, data)
    const response = await axios.post(`${ALIST_API_URL}/api/fs/list`, data, {
        headers: {
            'Authorization': ALIST_TOKEN,
            'Content-Type': 'application/json'
        }
    })
    // 等待2秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    return response.data;
}


// 通知tnn更新
async function notifyTMM(alistPath = '') {
    // curl -d '{"action":"scrape", "scope":{"name":"all"}}' -H "Content-Type: application/json" -H "api-key: f8ea228e-2caf-48b0-9aae-7501f8a34568" -X POST http://localhost:7878/api/movies
    // TMM_API_URL
    // TMM_API_KEY
    // action：update -> 更新文件
    // action：scrape -> 搜刮


    // curl -d '{"action":"update", "scope":{"name":"all"}}' -H "Content-Type: application/json" -H "api-key: f8ea228e-2caf-48b0-9aae-7501f8a34568" -X POST http://localhost:7878/api/movies


    let updateApiPathMov = `${TMM_API_URL}/api/movies`
    let updateApiPathTv = `${TMM_API_URL}/api/tvshows`

    console.log(`notifyTMM updateApiPathMov:${updateApiPathMov} updateApiPathTv:${updateApiPathTv}`)

    try {
        let updateResponse, renameResponse, scrapeResponse

        if (alistPath?.includes('mov') || !alistPath) {
            updateResponse = await axios.post(updateApiPathMov, { action: 'update', scope: { name: 'all', } }, { headers: { 'api-key': TMM_API_KEY, 'Content-Type': 'application/json' } })
            scrapeResponse = await axios.post(updateApiPathMov, { action: 'scrape', scope: { name: 'new', } }, { headers: { 'api-key': TMM_API_KEY, 'Content-Type': 'application/json' } })
        }

        if (alistPath?.includes('tv') || !alistPath) {
            updateResponse = await axios.post(updateApiPathTv, { action: 'update', scope: { name: 'all', } }, { headers: { 'api-key': TMM_API_KEY, 'Content-Type': 'application/json' } })
            scrapeResponse = await axios.post(updateApiPathTv, { action: 'scrape', scope: { name: 'new', } }, { headers: { 'api-key': TMM_API_KEY, 'Content-Type': 'application/json' } })
        }

        updateResponse = Boolean(updateResponse)
        // renameResponse = Boolean(renameResponse)
        scrapeResponse = Boolean(scrapeResponse)

        // if (updateApiPathTv || updateApiPathMov) {
        //     await new Promise(resolve => setTimeout(resolve, 5000));
        // }

        console.log(`notifyTMM 通知TMM完成 updateResponse:${updateResponse} renameResponse:${renameResponse} scrapeResponse:${scrapeResponse}`)

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ message: `通知TMM完成 updateResponse:${updateResponse} renameResponse:${renameResponse} scrapeResponse:${scrapeResponse}` }));
            }
        });

        return { updateResponse: updateResponse, renameResponse, scrapeResponse };
    } catch (error) {
        console.error('notifyTMM error:', error);
        return error
    }
}
// 通知emby更新
async function notifyEmby(embyItemId) {
    let response
    console.log('generateStrm.js updateEmby embyItemId -> ', embyItemId)
    console.log('generateStrm.js url -> ', `${EMBY_API_URL}/emby/Items/${embyItemId}/Refresh?api_key=${EMBY_TOKEN}`)
    if (embyItemId) {
        response = await axios.post(`${EMBY_API_URL}/emby/Items/${embyItemId}/Refresh?api_key=${EMBY_TOKEN}`, undefined, {
            headers: {
                'accept': '*/*',
                'content-type': 'application/x-www-form-urlencoded'
            }
        })
    }

    if (response?.status != 200 && response?.status != 204) {
        console.log('generateStrm.js 更新库失败，准备全部扫描')
        bot.sendMessage(currentChatId, '通知Emby更新库失败，准备全部扫描');
        response = await axios.post(`${EMBY_API_URL}/emby/Library/Refresh?api_key=${EMBY_TOKEN}`, undefined, {
            headers: {
                'accept': '*/*',
                'content-type': 'application/x-www-form-urlencoded'
            },
        })
    }

    if (response.status != 200 && response.status != 204) {
        bot.sendMessage(currentChatId, '通知Emby更新库失败，全部扫描也失败了');
        console.log('generateStrm.js updateEmby 更新库失败，全部扫描也失败了 response -> ', response)
    }

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ message: `通知Emby完成 response.status:${response.status}` }));
        }
    });
    bot.sendMessage(currentChatId, `通知Emby完成 response.status:${response.status}`);

    return response.status == 200 || response.status == 204;
}

// 注意: 以下函数已经移除，因为不再使用
// createNfoFile - 用于生成电影信息文件
// downloadAndCopyFile - 用于下载和复制文件
