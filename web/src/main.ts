import Vue from 'vue';

import App from './App.vue';
import store from './store';
import router from './router';

import '@/style/index.less';
import '@/assets/main.css';

// 定义环境变量类型
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  // 其他环境变量...
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

const env: ImportMetaEnv = import.meta.env;
console.log('main.ts 前端接受 变量 env -> ', env);

// 创建 Vue 实例
new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');
