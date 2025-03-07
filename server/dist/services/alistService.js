"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAlist = updateAlist;
exports.getAlistPath = getAlistPath;
exports.readCachedVideoFiles = readCachedVideoFiles;
exports.saveVideoFilesCache = saveVideoFilesCache;
exports.clearVideoFilesCache = clearVideoFilesCache;
exports.getVideoFiles = getVideoFiles;
exports.autoCopyFile = autoCopyFile;
/**
 * Alist 服务
 * 处理所有与 Alist 相关的操作
 */
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config/config");
const ws_1 = __importDefault(require("ws"));
// 视频文件缓存路径
const VIDEO_FILES_CACHE = './videoFiles.json';
/**
 * 更新 Alist 数据
 * @param alistPath - Alist 路径
 */
async function updateAlist(alistPath) {
    try {
        const apiUrl = `${config_1.API_CONFIG.ALIST_API_URL}/api/fs/list`;
        const response = await axios_1.default.post(apiUrl, { path: alistPath, refresh: true }, {
            headers: {
                'Authorization': config_1.API_CONFIG.ALIST_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        return response.status === 200;
    }
    catch (error) {
        console.error('更新 Alist 失败:', error);
        return false;
    }
}
/**
 * 获取 Alist 路径下的内容
 * @param path - Alist 路径
 */
async function getAlistPath(path = '') {
    var _a, _b;
    const apiUrl = `${config_1.API_CONFIG.ALIST_API_URL}/api/fs/list`;
    console.log(`getAlistPath apiUrl -> ${apiUrl} path -> ${path}`);
    try {
        const response = await axios_1.default.post(apiUrl, { path }, {
            headers: {
                'Authorization': config_1.API_CONFIG.ALIST_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        return ((_b = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.content) || [];
    }
    catch (error) {
        console.error('获取 Alist 路径内容失败:', error);
        return [];
    }
}
/**
 * 读取缓存的视频文件列表
 */
async function readCachedVideoFiles() {
    try {
        if (!fs_1.default.existsSync(VIDEO_FILES_CACHE)) {
            return {};
        }
        const data = await fs_1.default.promises.readFile(VIDEO_FILES_CACHE, 'utf8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error('读取视频文件缓存失败:', error);
        return {};
    }
}
/**
 * 保存视频文件列表到缓存
 * @param path - Alist 路径
 * @param files - 文件列表
 */
async function saveVideoFilesCache(path, files) {
    try {
        const cache = await readCachedVideoFiles();
        cache[path] = {
            timestamp: Date.now(),
            files: files
        };
        await fs_1.default.promises.writeFile(VIDEO_FILES_CACHE, JSON.stringify(cache, null, 2), 'utf8');
    }
    catch (error) {
        console.error('保存视频文件缓存失败:', error);
    }
}
/**
 * 清空视频文件缓存
 */
async function clearVideoFilesCache() {
    try {
        if (fs_1.default.existsSync(VIDEO_FILES_CACHE)) {
            await fs_1.default.promises.unlink(VIDEO_FILES_CACHE);
            console.log('视频文件缓存已清空');
        }
    }
    catch (error) {
        console.error('清空视频文件缓存失败:', error);
    }
}
/**
 * 找到文件夹下的所有视频文件
 * @param alistPath - 文件夹路径
 * @param wss - WebSocket 服务器实例
 * @returns 所有文件、新文件和删除的文件列表
 */
async function getVideoFiles(alistPath, wss) {
    var _a;
    try {
        const apiUrl = `${config_1.API_CONFIG.ALIST_API_URL}/api/fs/list`;
        let refreshArr = [];
        let videoFiles = [];
        // 读取缓存的文件列表
        const cache = await readCachedVideoFiles();
        const cachedFiles = ((_a = cache[alistPath]) === null || _a === void 0 ? void 0 : _a.files) || [];
        async function fetchFiles(path) {
            var _a, _b, _c, _d;
            let refresh = !refreshArr.includes(path);
            const response = await axios_1.default.post(apiUrl, { path, refresh }, {
                headers: {
                    'Authorization': config_1.API_CONFIG.ALIST_TOKEN,
                    'Content-Type': 'application/json'
                }
            });
            refreshArr.push(path);
            refreshArr = [...new Set(refreshArr)];
            const items = ((_b = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.content) || [];
            const total = ((_d = (_c = response === null || response === void 0 ? void 0 : response.data) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.total) || 0;
            wss.clients.forEach(client => {
                if (client.readyState === ws_1.default.OPEN) {
                    client.send(JSON.stringify({ message: `${refresh} => ${path} -> 文件夹下的文件数量：${items.length} 文件夹数量：${total}` }));
                }
            });
            for (const item of items) {
                const fullPath = path + '/' + item.name;
                if (item.is_dir) {
                    await fetchFiles(fullPath);
                }
                else if (item.type === 2 || item.type === 3 || item.type === 5 || item.type === 0) {
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
            var _a;
            let videoMinSIZE = ((_a = item === null || item === void 0 ? void 0 : item.parent) === null || _a === void 0 ? void 0 : _a.includes('jav')) ? 100 : 10;
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
            return !cachedFiles.some(cachedFile => cachedFile.fullPath === newFile.fullPath &&
                cachedFile.size === newFile.size);
        });
        // 找出删除的文件
        const deletedFiles = cachedFiles.filter(cachedFile => {
            return !videoFiles.some(newFile => newFile.fullPath === cachedFile.fullPath &&
                newFile.size === cachedFile.size);
        });
        // 保存新的文件列表到缓存
        await saveVideoFilesCache(alistPath, videoFiles);
        return {
            allFiles: videoFiles,
            newFiles: newFiles,
            deletedFiles: deletedFiles,
        };
    }
    catch (error) {
        console.error('获取视频文件列表失败:', error);
        return {
            allFiles: [],
            newFiles: [],
            deletedFiles: [],
        };
    }
}
/**
 * 自动复制文件
 */
async function autoCopyFile() {
    try {
        // pan/115/Video/mov1 to pan/115/mov
        await copyFiles('/pan/115/Video/mov1', '/pan/115/mov');
        // pan/115/Video/tv1 to pan/115/tv
        await copyFiles('/pan/115/Video/tv1', '/pan/115/tv');
        // pan/115/Video/ami1 to pan/115/sth
        await copyFiles('/pan/115/Video/ami1', '/pan/115/sth');
    }
    catch (error) {
        console.error('自动复制文件失败:', error);
    }
}
/**
 * 复制文件
 * @param srcDir - 源目录
 * @param dstDir - 目标目录
 */
async function copyFiles(srcDir, dstDir) {
    var _a, _b;
    try {
        let names = [];
        const listUrl = `${config_1.API_CONFIG.ALIST_API_URL}/api/fs/list`;
        const listResponse = await axios_1.default.post(listUrl, { path: srcDir, refresh: true }, {
            headers: {
                'Authorization': config_1.API_CONFIG.ALIST_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        if ((_b = (_a = listResponse === null || listResponse === void 0 ? void 0 : listResponse.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.content) {
            names = listResponse.data.data.content.map((item) => item.name);
        }
        console.log(`复制文件: 源 ${srcDir} 目标 ${dstDir} 文件数: ${names.length}`);
        if (!names.length) {
            return;
        }
        const copyUrl = `${config_1.API_CONFIG.ALIST_API_URL}/api/fs/move`;
        const copyResponse = await axios_1.default.post(copyUrl, { src_dir: srcDir, dst_dir: dstDir, names }, {
            headers: {
                'Authorization': config_1.API_CONFIG.ALIST_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        console.log(`复制文件结果:`, copyResponse.data);
    }
    catch (error) {
        console.error(`复制文件失败 [${srcDir} -> ${dstDir}]:`, error);
    }
}
