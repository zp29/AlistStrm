"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUSIC_API = exports.SERVER_CONFIG = exports.TELEGRAM_CONFIG = exports.API_CONFIG = exports.SERVER_HOST = void 0;
// 服务器主机配置
exports.SERVER_HOST = process.env.Server_Host || 'http://127.0.0.1';
// API配置
exports.API_CONFIG = {
    TMM_API_KEY: process.env.TMM_API_KEY || 'f8ea228e-2caf-48b0-9aae-7501f8a34568',
    EMBY_TOKEN: process.env.EMBY_TOKEN || '6dbc93c10273476fafe2dd92ca7f678c',
    ALIST_TOKEN: process.env.ALIST_TOKEN || 'alist-1c1478bf-93dd-4c07-b1cc-062a51596c03o9LdU8xedrhIumaf7MTDHfh7e8gk7lQFQcYcxro4nShuE3Q3H5wpGTYG8LnoqzpN',
    EMBY_API_URL: process.env.EMBY_API_URL || 'http://emby.zp29.net:8096',
    ALIST_API_URL: process.env.ALIST_API_URL || 'http://alist.zp29.net:5344',
    TMM_API_URL: process.env.TMM_API_URL || `${exports.SERVER_HOST}:7878`,
    SERVER_HOST: exports.SERVER_HOST,
    OUTPUT_DIR: process.env.outputDir || './outputDir'
};
// Telegram Bot 配置
exports.TELEGRAM_CONFIG = {
    TOKEN: '7580922585:AAEg6t5WsExm86x5jiIygH-dqOnvPy5JuwA',
    AUTHORIZED_USERNAME: 'aliensrt29' // 授权用户名
};
// 服务器配置
exports.SERVER_CONFIG = {
    PORT: process.env.PORT || 3000,
    WS_PORT: 18095
};
// 音乐API配置
exports.MUSIC_API = {
    URL: 'http://music.zp29.net:29/api/songs'
};
