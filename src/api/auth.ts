import http from './index'
import type { ApiResponse, LoginParams, LoginResult, UserInfo } from '@/types'

export function login(params: LoginParams) {
  return http.post<ApiResponse<LoginResult>>('/auth/login', params)
}

export function logout() {
  return http.post<ApiResponse<null>>('/auth/logout')
}

export function getUserInfo() {
  return http.get<ApiResponse<UserInfo>>('/users/me')
}
