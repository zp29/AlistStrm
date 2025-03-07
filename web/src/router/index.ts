import Vue from 'vue';
import VueRouter, { RouteConfig, Route, Position, PositionResult } from 'vue-router';

import demoRouters from './modules/demo';

// 注册路由插件
Vue.use(VueRouter);

// 路由配置
const routes: Array<RouteConfig> = [...demoRouters];

// 创建路由实例
const router = new VueRouter({
  mode: 'history',
  base: import.meta.env.BASE_URL as string,
  routes,
  scrollBehavior(): PositionResult {
    return { x: 0, y: 0 };
  },
});

// 全局前置导航守卫 - 如需要可以打开注释
// router.beforeEach((to: Route, from: Route, next: Function) => {
//   // 添加路由导航逻辑
//   next();
// });

export default router;
