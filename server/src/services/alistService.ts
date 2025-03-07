/**
 * Alist 服务
 * 处理所有与 Alist 相关的操作
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { VideoFile, VideoFilesResult } from '../types';
import { API_CONFIG } from '../config/config';
import WebSocket from 'ws';

// 视频文件缓存路径
const VIDEO_FILES_CACHE = './videoFiles.json';

/**
 * 更新 Alist 数据
 * @param alistPath - Alist 路径
 */
export async function updateAlist(alistPath: string): Promise<boolean> {
  try {
    const apiUrl = `${API_CONFIG.ALIST_API_URL}/api/fs/list`;
    const response = await axios.post(apiUrl, { path: alistPath, refresh: true }, {
      headers: {
        'Authorization': API_CONFIG.ALIST_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    return response.status === 200;
  } catch (error) {
    console.error('更新 Alist 失败:', error);
    return false;
  }
}

/**
 * 获取 Alist 路径下的内容
 * @param path - Alist 路径
 */
export async function getAlistPath(path = ''): Promise<any[]> {
  const apiUrl = `${API_CONFIG.ALIST_API_URL}/api/fs/list`;
  console.log(`getAlistPath apiUrl -> ${apiUrl} path -> ${path}`);

  try {
    const response = await axios.post(apiUrl, { path }, {
      headers: {
        'Authorization': API_CONFIG.ALIST_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    return response?.data?.data?.content || [];
  } catch (error) {
    console.error('获取 Alist 路径内容失败:', error);
    return [];
  }
}

/**
 * 读取缓存的视频文件列表
 */
export async function readCachedVideoFiles(): Promise<Record<string, any>> {
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
 * @param path - Alist 路径
 * @param files - 文件列表
 */
export async function saveVideoFilesCache(path: string, files: VideoFile[]): Promise<void> {
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
export async function clearVideoFilesCache(): Promise<void> {
  try {
    if (fs.existsSync(VIDEO_FILES_CACHE)) {
      await fs.promises.unlink(VIDEO_FILES_CACHE);
      console.log('视频文件缓存已清空');
    }
  } catch (error) {
    console.error('清空视频文件缓存失败:', error);
  }
}

/**
 * 找到文件夹下的所有视频文件
 * @param alistPath - 文件夹路径
 * @param wss - WebSocket 服务器实例
 * @returns 所有文件、新文件和删除的文件列表
 */
export async function getVideoFiles(alistPath: string, wss: WebSocket.Server): Promise<VideoFilesResult> {
  try {
    const apiUrl = `${API_CONFIG.ALIST_API_URL}/api/fs/list`;
    let refreshArr: string[] = [];
    let videoFiles: VideoFile[] = [];

    // 读取缓存的文件列表
    const cache = await readCachedVideoFiles();
    const cachedFiles = cache[alistPath]?.files || [];

    async function fetchFiles(path: string) {
      let refresh = !refreshArr.includes(path);
      const response = await axios.post(apiUrl, { path, refresh }, {
        headers: {
          'Authorization': API_CONFIG.ALIST_TOKEN,
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

    // 找出删除的文件
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

/**
 * 自动复制文件
 */
export async function autoCopyFile(): Promise<void> {
  try {
    // pan/115/Video/mov1 to pan/115/mov
    await copyFiles('/pan/115/Video/mov1', '/pan/115/mov');
    // pan/115/Video/tv1 to pan/115/tv
    await copyFiles('/pan/115/Video/tv1', '/pan/115/tv');
    // pan/115/Video/ami1 to pan/115/sth
    await copyFiles('/pan/115/Video/ami1', '/pan/115/sth');
  } catch (error) {
    console.error('自动复制文件失败:', error);
  }
}

/**
 * 复制文件
 * @param srcDir - 源目录
 * @param dstDir - 目标目录
 */
async function copyFiles(srcDir: string, dstDir: string): Promise<void> {
  try {
    let names: string[] = [];
    const listUrl = `${API_CONFIG.ALIST_API_URL}/api/fs/list`;
    const listResponse = await axios.post(listUrl, { path: srcDir, refresh: true }, {
      headers: {
        'Authorization': API_CONFIG.ALIST_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    if (listResponse?.data?.data?.content) {
      names = listResponse.data.data.content.map((item: any) => item.name);
    }
    
    console.log(`复制文件: 源 ${srcDir} 目标 ${dstDir} 文件数: ${names.length}`);
    
    if (!names.length) {
      return;
    }
    
    const copyUrl = `${API_CONFIG.ALIST_API_URL}/api/fs/move`;
    const copyResponse = await axios.post(copyUrl, { src_dir: srcDir, dst_dir: dstDir, names }, {
      headers: {
        'Authorization': API_CONFIG.ALIST_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`复制文件结果:`, copyResponse.data);
  } catch (error) {
    console.error(`复制文件失败 [${srcDir} -> ${dstDir}]:`, error);
  }
}
