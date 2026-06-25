import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo } from '@/types'
import * as authApi from '@/api/auth'

/**
 * 认证 Store（兼容层）
 * TODO: 迁移到 AuthViewModel
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const user = ref<UserInfo | null>(null)
  const isLoggedIn = ref(!!token.value)

  async function login(email: string, password: string) {
    const res = await authApi.login({ email, password })
    const data = res.data.data
    token.value = data.accessToken
    user.value = data.user
    isLoggedIn.value = true
    localStorage.setItem('token', data.accessToken)
  }

  async function fetchUserInfo() {
    const res = await authApi.getUserInfo()
    user.value = res.data.data
  }

  function logout() {
    token.value = ''
    user.value = null
    isLoggedIn.value = false
    localStorage.removeItem('token')
  }

  return { token, user, isLoggedIn, login, fetchUserInfo, logout }
})
