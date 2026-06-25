import axios from 'axios'
import type { ApiResponse } from '@/types'

const http = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5分钟，上传大文件需要更长超时
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：注入 JWT token
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器：统一处理错误
http.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse
    if (data.code !== 0 && data.code !== 200) {
      return Promise.reject(new Error(data.message || '请求失败'))
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default http
