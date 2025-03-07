"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDirRecursively = createDirRecursively;
exports.createStrmFile = createStrmFile;
exports.clearStrmFile = clearStrmFile;
exports.cleanEmptyDirectories = cleanEmptyDirectories;
/**
 * 文件服务
 * 处理所有与文件系统相关的操作，包括创建目录、STRM文件生成等
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config/config");
/**
 * 创建目录（递归）
 * @param dir - 目录路径
 */
async function createDirRecursively(dir) {
    if (!fs_1.default.existsSync(dir)) {
        await fs_1.default.promises.mkdir(dir, { recursive: true });
    }
}
/**
 * 生成STRM文件
 * @param outputPath - 输出文件路径
 * @param videoFilePath - 视频文件路径
 */
async function createStrmFile(outputPath, videoFilePath) {
    // 检查strm文件是否已存在
    if (fs_1.default.existsSync(outputPath)) {
        console.log(`STRM文件已存在，跳过创建: ${outputPath}`);
        return;
    }
    const strmContent = config_1.API_CONFIG.ALIST_API_URL + '/d' + videoFilePath;
    await fs_1.default.promises.writeFile(outputPath, strmContent);
    console.log(`创建STRM文件: ${outputPath}`);
}
/**
 * 清理STRM文件
 * @param newFiles - 新增的文件
 * @param deletedFiles - 删除的文件
 * @param outputDir - 输出目录
 */
async function clearStrmFile(newFiles, deletedFiles, outputDir) {
    try {
        // 读取现有的 videoFiles.json
        let videoFilesData = {};
        const videoFilesPath = path_1.default.join(process.cwd(), 'videoFiles.json');
        if (fs_1.default.existsSync(videoFilesPath)) {
            const data = await fs_1.default.promises.readFile(videoFilesPath, 'utf8');
            videoFilesData = JSON.parse(data);
        }
        // 处理需要删除的文件
        for (const file of deletedFiles) {
            const strmPath = path_1.default.join(outputDir, file.parent, `${path_1.default.basename(file.name, path_1.default.extname(file.name))}.strm`);
            // 只删除 .strm 文件
            if (fs_1.default.existsSync(strmPath)) {
                await fs_1.default.promises.unlink(strmPath);
                console.log(`已删除STRM文件: ${strmPath}`);
                // 从 videoFiles.json 中移除记录
                const key = path_1.default.join(file.parent, file.name);
                delete videoFilesData[key];
            }
        }
        // 更新 newFiles 到 videoFiles.json
        for (const file of newFiles) {
            const key = path_1.default.join(file.parent, file.name);
            videoFilesData[key] = {
                parent: file.parent,
                name: file.name,
                type: file.type,
                isMainVideo: file.isMainVideo,
                updatedAt: new Date().toISOString()
            };
        }
        // 保存更新后的 videoFiles.json
        await fs_1.default.promises.writeFile(videoFilesPath, JSON.stringify(videoFilesData, null, 2), 'utf8');
        console.log('videoFiles.json 更新成功');
        // 清理空目录
        await cleanEmptyDirectories(outputDir);
    }
    catch (error) {
        console.error('清理STRM文件时出错:', error);
        throw error;
    }
}
/**
 * 递归清理空目录
 * @param directory - 要清理的目录
 */
async function cleanEmptyDirectories(directory) {
    try {
        const files = await fs_1.default.promises.readdir(directory);
        for (const file of files) {
            const fullPath = path_1.default.join(directory, file);
            const stat = await fs_1.default.promises.stat(fullPath);
            if (stat.isDirectory()) {
                await cleanEmptyDirectories(fullPath);
                // 再次检查目录是否为空
                const afterFiles = await fs_1.default.promises.readdir(fullPath);
                if (afterFiles.length === 0) {
                    await fs_1.default.promises.rmdir(fullPath);
                    console.log(`删除空目录: ${fullPath}`);
                }
            }
        }
    }
    catch (error) {
        console.error('清理空目录时出错:', error);
    }
}
