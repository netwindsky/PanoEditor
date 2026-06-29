import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

/**
 * 复现 bug：登录成功后 handleLogin 没有任何路由跳转，
 * 仅依赖路由守卫——但用户已停留在 /login，不会触发新导航，
 * 必须手动刷新才能进入编辑器。
 * 期望：登录成功后应主动 router.push 到编辑器。
 */

// mock useAuth：login 解析成功（模拟登录成功）
const loginMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ login: loginMock }),
}))

// mock vue-router 的 useRouter，捕获 push 调用
const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

import LoginView from './LoginView.vue'

const globalStubs = {
  // el-form：渲染为原生 form，validate 永远通过。
  // 不在 stub 内 emit submit——直接让 trigger('submit') 通过原生 submit
  // 的 fallthrough 监听触达 handleLogin，避免组件事件 + 原生事件双重触发。
  'el-form': {
    template: '<form><slot /></form>',
    methods: {
      validate() {
        return Promise.resolve(true)
      },
    },
  },
  'el-form-item': { template: '<div><slot /></div>' },
  'el-input': {
    props: ['modelValue'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  'el-button': {
    template: '<button v-bind="$attrs"><slot /></button>',
    inheritAttrs: false,
  },
}

describe('LoginView 登录成功跳转', () => {
  beforeEach(() => {
    loginMock.mockClear()
    pushMock.mockClear()
  })

  it('登录成功后应跳转到编辑器', async () => {
    const wrapper = mount(LoginView, {
      global: { stubs: globalStubs },
    })

    // 填入合法表单值
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('user@example.com')
    await inputs[1].setValue('password123')

    // 触发表单提交
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(loginMock).toHaveBeenCalledWith('user@example.com', 'password123')
    // 关键断言：登录成功后必须发生路由跳转
    expect(pushMock).toHaveBeenCalledTimes(1)
  })
})
