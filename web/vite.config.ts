import { resolve } from 'path';
import { defineConfig, loadEnv, UserConfig } from 'vite';
import vue2 from '@vitejs/plugin-vue2';

import Components from 'unplugin-vue-components/vite';
import { ElementUiResolver } from 'unplugin-vue-components/resolvers';

// 环境变量类型
interface ImportMetaEnv {
  readonly VITE_PORT: number;
  readonly VITE_BASE_URL: string;
  // 其他环境变量...
  [key: string]: any;
}

export default ({ mode }: { mode: string }): UserConfig => {
  const env = loadEnv(mode, process.cwd());
  const VITE_PORT = parseInt(env.VITE_PORT || '3000', 10);
  const VITE_BASE_URL = env.VITE_BASE_URL || '/';

  return defineConfig({
    base: VITE_BASE_URL,
    plugins: [
      vue2(),
      Components({
        resolvers: [ElementUiResolver()],
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
      // 添加对 .ts 文件的支持
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    // 指定入口文件
    build: {
      // 设置最终构建的浏览器兼容目标
      target: 'es2015',
      // 构建后是否生成 source map 文件
      sourcemap: false,
      //  chunk 大小警告的限制（以 kbs 为单位）
      chunkSizeWarningLimit: 2000,
      // 启用/禁用 gzip 压缩大小报告
      reportCompressedSize: false,
      rollupOptions: {
        // 指定入口文件
        input: {
          main: resolve(__dirname, 'index.html')
        }
      }
    },
    css: {
      preprocessorOptions: {
        less: {
          modifyVars: {
            hack: `true; @import (reference) "${resolve('src/style/variables.less')}";`,
          },
          math: 'strict',
          javascriptEnabled: true,
        },
      },
    },
    server: {
      // 是否开启 https
      https: false,
      // 端口号
      port: VITE_PORT,
      // 监听所有地址
      host: '0.0.0.0',
      // 服务启动时是否自动打开浏览器
      open: true,
      // 允许跨域
      cors: true,
      // 自定义代理规则
      proxy: {},
    },
  });
};
