/**
 * 全局类型定义文件
 */

// 用户状态类型
export interface UserState {
  action: string;
  [key: string]: any;
}

// 视频文件类型
export interface VideoFile {
  name: string;
  parent: string;
  parentSize?: number;
  is_dir?: boolean;
  size?: number;
  type: number; // 2: 视频, 3: 音频, 5/0: 图片
  isMainVideo?: boolean;
  fullPath?: string;
  path?: string;
}

// 音乐项目类型
export interface MusicItem {
  text: string;
  url: string;
}

// API配置类型
export interface ApiConfig {
  TMM_API_KEY: string;
  EMBY_TOKEN: string;
  ALIST_TOKEN: string;
  EMBY_API_URL: string;
  ALIST_API_URL: string;
  TMM_API_URL: string;
  SERVER_HOST: string;
  OUTPUT_DIR: string;
}

// Telegram 配置类型
export interface TelegramConfig {
  TOKEN: string;
  AUTHORIZED_USERNAME: string;
}

// 音乐 API 配置类型
export interface MusicApiConfig {
  URL: string;
}

// 自动同步项目类型
export interface AutoItem {
  name: string;
  path: string;
  auto: boolean;
}

// Alist文件更新结果
export interface VideoFilesResult {
  allFiles: VideoFile[];
  newFiles: VideoFile[];
  deletedFiles: VideoFile[];
}

// 链接项目类型
export interface LinkItem {
  name: string;
  url: string;
  description?: string;
}

// WebSocket 消息类型
export interface WsMessage {
  status?: string;
  message?: string;
  total?: number | string;
}
