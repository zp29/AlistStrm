/**
 * 文件服务
 * 处理所有与文件系统相关的操作，包括创建目录、STRM文件生成等
 */
import fs from 'fs';
import path from 'path';
import { VideoFile } from '../types';
import { API_CONFIG } from '../config/config';

/**
 * 创建目录（递归）
 * @param dir - 目录路径
 */
export async function createDirRecursively(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

/**
 * 生成STRM文件
 * @param outputPath - 输出文件路径
 * @param videoFilePath - 视频文件路径
 */
export async function createStrmFile(outputPath: string, videoFilePath: string): Promise<void> {
  // 检查strm文件是否已存在
  if (fs.existsSync(outputPath)) {
    console.log(`STRM文件已存在，跳过创建: ${outputPath}`);
    return;
  }

  const strmContent = API_CONFIG.ALIST_API_URL + '/d' + videoFilePath;
  await fs.promises.writeFile(outputPath, strmContent);
  console.log(`创建STRM文件: ${outputPath}`);
}

/**
 * 清理STRM文件
 * @param newFiles - 新增的文件
 * @param deletedFiles - 删除的文件
 * @param outputDir - 输出目录
 */
export async function clearStrmFile(
  newFiles: VideoFile[], 
  deletedFiles: VideoFile[], 
  outputDir: string
): Promise<void> {
  try {
    // 读取现有的 videoFiles.json
    let videoFilesData: Record<string, any> = {};
    const videoFilesPath = path.join(process.cwd(), 'videoFiles.json');
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
}

/**
 * 递归清理空目录
 * @param directory - 要清理的目录
 */
export async function cleanEmptyDirectories(directory: string): Promise<void> {
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
          console.log(`删除空目录: ${fullPath}`);
        }
      }
    }
  } catch (error) {
    console.error('清理空目录时出错:', error);
  }
}
