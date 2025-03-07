import { RouteConfig } from 'vue-router';

// 首页路由配置
const routes: Array<RouteConfig> = [
  {
    path: '/',
    name: 'home',
    component: () => import('../../App.vue'),
    meta: {
      title: '首页'
    }
  }
];

export default routes;
