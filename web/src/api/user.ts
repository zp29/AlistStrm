import { post } from '@/utils/request';
import { AxiosResponse } from 'axios';

// 定义登录参数接口
interface LoginParams {
  username: string;
  password: string;
}

// 定义登录响应接口
interface LoginResponse {
  code: number;
  message: string;
  data?: {
    token?: string;
    user?: {
      id: number;
      username: string;
      [key: string]: any;
    };
  };
}

/**
 * 用户相关的 API 类
 */
export default class User {
  /**
   * 登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<AxiosResponse<LoginResponse>>} - 登录响应
   */
  static async login(username: string, password: string): Promise<AxiosResponse<LoginResponse>> {
    return post('/login', {
      username,
      password,
    });
  }
}
