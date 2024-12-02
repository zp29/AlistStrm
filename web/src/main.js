import Vue from 'vue';

import App from './App.vue';
import store from './store';
import router from './router';


import '@/style/index.less';
import '@/assets/main.css';

const env = import.meta.env;
console.log('app.js 前端接受 变量 env -> ', env)

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');
