/**
 * 是否为开发环境
 * @returns {boolean} 开发环境返回 true，否则返回 false
 */
export const isDev = (): boolean => {
  return import.meta.env.DEV;
};

/**
 * 是否为生产环境
 * @returns {boolean} 生产环境返回 true，否则返回 false
 */
export const isProd = (): boolean => {
  return import.meta.env.PROD;
};

/**
 * 获取环境变量
 * @param {string} key - 环境变量名称
 * @param {string} [defaultValue=''] - 默认值
 * @returns {string} 环境变量值
 */
export const getEnv = (key: string, defaultValue: string = ''): string => {
  return import.meta.env[key] || defaultValue;
};
