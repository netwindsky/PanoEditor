import { useAuthStore } from '@/stores/auth'

/**
 * 认证组合式函数（兼容层）
 * TODO: 迁移到 AuthViewModel
 */
export function useAuth() {
  const authStore = useAuthStore()

  return {
    token: computed(() => authStore.token),
    user: computed(() => authStore.user),
    isLoggedIn: computed(() => authStore.isLoggedIn),
    login: authStore.login,
    logout: authStore.logout,
    fetchUserInfo: authStore.fetchUserInfo,
  }
}
