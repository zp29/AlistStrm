import Vue from 'vue';
import Vuex, { StoreOptions, ModuleTree } from 'vuex';

// 定义全局状态类型
interface RootState {
  // 根状态属性
  version: string;
}

// 使用 TypeScript 的 Record 类型来定义模块集合
const modules: Record<string, any> = {};

// 注意我们现在加载 .ts 文件
const files = import.meta.glob('./modules/*.ts', {
  eager: true,
});

Object.keys(files).forEach((key) => {
  // 修改正则表达式来匹配 .ts 文件
  const moduleName = key.substring(key.lastIndexOf('/') + 1, key.lastIndexOf('.ts'));
  modules[moduleName] = files[key].default;
});

Vue.use(Vuex);

// 创建一个符合 Vuex 类型的 store 配置
const storeOptions: StoreOptions<RootState> = {
  // 严格模式
  strict: import.meta.env.MODE !== 'production',
  state: {
    version: '1.0.0'
  },
  modules: modules as ModuleTree<RootState>
};

const store = new Vuex.Store<RootState>(storeOptions);

export default store;
