/**
 * STRM 控制器
 * 处理与 STRM 文件生成相关的路由请求
 */
import { Request, Response } from 'express';
import WebSocket from 'ws';
import path from 'path';
import { API_CONFIG } from '../config/config';
import { updateAlist, getVideoFiles, getAlistPath } from '../services/alistService';
import { clearStrmFile, createStrmFile, createDirRecursively } from '../services/fileService';
import { notifyTMM, notifyEmby } from '../services/apiService';
import { VideoFile } from '../types';
import { currentChatId, bot } from '../services/telegramService';

/**
 * 生成 STRM 文件
 */
export async function generateStrm(req: Request, res: Response, wss: WebSocket.Server): Promise<void> {
  res.header("Access-Control-Allow-Origin", "*");
  let { alistPath, embyItemId, outputDir = './outputDir', initial = false } = req.body;

  outputDir = API_CONFIG.OUTPUT_DIR || './outputDir';

  if (!alistPath) {
    res.status(400).send({ status: 'error', message: 'alistPath is required' });
    return;
  }

  console.log('generateStrm alistPath, embyItemId, outputDir -> ', alistPath, embyItemId, outputDir);

  try {
    // 发送开始消息
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ status: 'start', total: '??' }));
      }
    });

    console.log('generateStrm 更新Alist');
    if (currentChatId) bot.sendMessage(currentChatId, `${alistPath} => 开始更新Alist`);
    await updateAlist(alistPath);
    if (currentChatId) bot.sendMessage(currentChatId, `${alistPath} => 更新Alist完成`);

    const { allFiles, newFiles, deletedFiles } = await getVideoFiles(alistPath, wss);
    console.log(`generateStrm 更新Alist，总共${allFiles.length}个文件，新增${newFiles.length}个文件, 删除${deletedFiles.length}个文件`);
    if (currentChatId) bot.sendMessage(currentChatId, `${alistPath} => 总共${allFiles.length}个文件，新增${newFiles.length}个文件，删除${deletedFiles.length}个文件`);

    // 发送更新消息
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ message: `更新Alist，总共${allFiles.length}个文件，新增${newFiles.length}个文件，删除${deletedFiles.length}个文件` }));
      }
    });

    await clearStrmFile(newFiles, deletedFiles, outputDir);

    console.log('generateStrm 开始创建Strm');
    let currentPatDiv: { parent?: string; length?: number } = {};
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

      if (!currentPatDiv.parent) {
        currentPatDiv.parent = video.parent;
        currentPatDiv.length = 0;
      } else {
        currentPatDiv.length = (currentPatDiv.length || 0) + 1;
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
        };
      }
    }

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ message: `${alistPath} => 共${allFiles.length}个文件，生成STRM完成` }));
      }
    });
    console.log('generateStrm STRM完成', new Date().toLocaleString());
    if (currentChatId) bot.sendMessage(currentChatId, `${alistPath} => generateStrm STRM完成${new Date().toLocaleString()}`);

    // 发送完成消息
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ status: 'done', total: allFiles.length }));
      }
    });
    res.status(200).send('strm files are being generated.');

  } catch (error) {
    console.error('Error generating strm files:', error);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ status: 'error', message: `error->${error}` }));
      }
    });
    res.status(500).send('Error generating strm files.');
  }
}

/**
 * 获取 Alist 路径内容
 */
export async function getPath(req: Request, res: Response): Promise<void> {
  const { path } = req.body;
  const result = await getAlistPath(path);
  res.status(200).send(result);
}

/**
 * 更新 TMM
 */
export async function updateTMM(req: Request, res: Response, wss: WebSocket.Server): Promise<void> {
  res.header("Access-Control-Allow-Origin", "*");
  
  let { updateResponse, renameResponse, scrapeResponse } = await notifyTMM();
  
  // 通知 WebSocket 客户端
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
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
export async function updateEmby(req: Request, res: Response): Promise<void> {
  res.header("Access-Control-Allow-Origin", "*");
  
  let notifyEmbyState = await notifyEmby();
  res.status(200).send({ status: notifyEmbyState ? 'success' : 'error' });
}
