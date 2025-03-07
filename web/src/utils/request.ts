import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// 创建请求实例
const instance = axios.create({
  baseURL: '/api',
  // 指定请求超时的毫秒数
  timeout: 1000 * 60 * 3,
  // 表示跨域请求时是否需要使用凭证
  withCredentials: false,
});

// 定义请求配置接口
interface RequestConfig extends AxiosRequestConfig {
  headers?: any; // 允许对 headers 进行任意属性赋值
}

// 前置拦截器（发起请求之前的拦截）
instance.interceptors.request.use(
  (config: RequestConfig) => {
    /**
     * 在这里一般会携带前台的参数发送给后台，比如下面这段代码：
     * const token = getToken()
     * if (token) {
     *  config.headers.token = token
     * }
     */
    config.headers = {
      // 'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
      'Content-Type': 'application/json',
    };
    console.log('request.ts config -> ', config);
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// 后置拦截器（获取到响应时的拦截）
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    /**
     * 根据你的项目实际情况来对 response 和 error 做处理
     * 这里对 response 和 error 不做任何处理，直接返回
     */
    return response;
  },
  (error: AxiosError) => {
    const { response } = error;
    if (response && response.data) {
      return Promise.reject(error);
    }
    const { message } = error;
    console.error(message);
    return Promise.reject(error);
  },
);

// 导出常用函数

/**
 * POST 请求函数
 * @param {string} url - 请求地址
 * @param {object} data - 请求体数据
 * @param {object} params - URL参数
 * @returns {Promise<AxiosResponse>} - 返回响应Promise
 */
export function post(url: string, data: any = {}, params: any = {}): Promise<AxiosResponse> {
  return instance({
    method: 'post',
    url,
    data,
    params,
  });
}

/**
 * GET 请求函数
 * @param {string} url - 请求地址
 * @param {object} params - URL参数
 * @returns {Promise<AxiosResponse>} - 返回响应Promise
 */
export function get(url: string, params: any = {}): Promise<AxiosResponse> {
  return instance({
    method: 'get',
    url,
    params,
  });
}

/**
 * PUT 请求函数
 * @param {string} url - 请求地址
 * @param {object} data - 请求体数据
 * @param {object} params - URL参数
 * @returns {Promise<AxiosResponse>} - 返回响应Promise
 */
export function put(url: string, data: any = {}, params: any = {}): Promise<AxiosResponse> {
  return instance({
    method: 'put',
    url,
    params,
    data,
  });
}

/**
 * DELETE 请求函数
 * @param {string} url - 请求地址
 * @param {object} params - URL参数
 * @returns {Promise<AxiosResponse>} - 返回响应Promise
 */
export function _delete(url: string, params: any = {}): Promise<AxiosResponse> {
  return instance({
    method: 'delete',
    url,
    params,
  });
}

export default instance;
