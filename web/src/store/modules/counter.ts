// 定义状态类型
interface CounterState {
  count: number;
}

// 初始状态
const state: CounterState = {
  count: 0,
};

// 变更事件
const mutations = {
  increment(state: CounterState): void {
    state.count++;
  },
};

// 定义动作类型
type ActionContext = {
  commit: (type: string, payload?: any) => void;
};

// 动作
const actions = {
  increment({ commit }: ActionContext): void {
    commit('increment');
  },
};

// 导出模块
export default {
  namespaced: true,
  state,
  mutations,
  actions,
};
