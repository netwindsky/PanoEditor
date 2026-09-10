import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import LightingPanel from './LightingPanel.vue'
import { LightingViewModel } from '@/viewmodels/LightingViewModel'
import type { EditorViewModel } from '@/viewmodels/EditorViewModel'
import type { LightingConfig } from '@/types'

/**
 * LightingPanel（V 层）行为回归测试。
 *
 * 锁定历史 bug：调强度滑块时用表单旧方位角/仰角覆盖 gizmo 拖拽结果（太阳回跳）。
 * MVC 重构后：面板零状态，交互 → LightingViewModel（M 层）；
 * 引擎方向与 DB 方向永远取自 VM 单一状态，字段级隔离使覆盖在结构上不可能。
 *
 * el-slider / el-switch 用最小 stub 替换（保留 update:modelValue 契约），
 * 避免在 jsdom 中模拟 el-slider 的指针拖拽。
 */

const SCENE_ID = 'scene-1'
const BACKEND_CONFIG: LightingConfig = {
  id: 'light-1',
  sceneId: SCENE_ID,
  envMapUrl: null,
  sunEnabled: true,
  sunAzimuth: 100,
  sunElevation: 30,
  sunIntensity: 2,
  sunColor: '#ffffff',
}

function okApiResponse(body: LightingConfig): { data: { code: number; data: LightingConfig } } {
  return { data: { code: 0, data: body } }
}

const getLightingMock = vi.fn()
const updateLightingMock = vi.fn()
const setSunLightMock = vi.fn()
const setEnvironmentMapMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@/api/lighting', async () => {
  // 纯函数（toSunConfig/envMapFileName/mergeSunConfig 等）保留真实实现，只 mock 网络请求
  const actual = await vi.importActual<typeof import('@/api/lighting')>('@/api/lighting')
  return {
    ...actual,
    getLighting: (...args: unknown[]) => getLightingMock(...args),
    updateLighting: (...args: unknown[]) => updateLightingMock(...args),
  }
})

vi.mock('@/api/resource', () => ({
  uploadResource: vi.fn(),
}))

/** el-slider 最小 stub：受控 input，emit update:modelValue */
const SliderStub = defineComponent({
  name: 'SliderStub',
  props: { modelValue: { type: Number, required: true } },
  emits: ['update:modelValue', 'change'],
  template: `<input :value="modelValue" @input="onInput" />`,
  methods: {
    onInput(e: Event) {
      const v = Number((e.target as HTMLInputElement).value)
      this.$emit('update:modelValue', v)
    },
  },
})

/** el-switch 最小 stub：受控 checkbox，emit update:modelValue */
const SwitchStub = defineComponent({
  name: 'SwitchStub',
  props: { modelValue: { type: Boolean, required: true } },
  emits: ['update:modelValue', 'change'],
  template: `<input type="checkbox" :checked="modelValue" @change="onToggle" />`,
  methods: {
    onToggle(e: Event) {
      const v = (e.target as HTMLInputElement).checked
      this.$emit('update:modelValue', v)
    },
  },
})

/** 空壳 stub：非关注组件 */
const EmptyStub = { template: '<span />' }

/**
 * 场景引用必须用真 ref：VM 构造时 watch 场景 id（切换场景测试需要触发）。
 * 持有在模块级变量，供测试直接改值模拟切场景。
 */
const vmSceneRef = ref<string | null>(SCENE_ID)

/** 构造真实 LightingViewModel + mock 引擎，挂到假 EditorViewModel 上 */
let activeLightingVm: LightingViewModel | null = null

function makeVm(): EditorViewModel {
  const lightingVm = new LightingViewModel({
    getSceneId: () => vmSceneRef.value,
    getProjectId: () => 'p1',
    onDirty: vi.fn(),
  })
  activeLightingVm = lightingVm
  lightingVm.attachEngine({
    setSunLight: setSunLightMock,
    getSunLightConfig: vi.fn(() => null),
    setEnvironmentMap: setEnvironmentMapMock,
  } as never)
  // VM 场景 watch 无 immediate：模拟生产中"项目加载后场景首次确定"触发加载
  void lightingVm.loadForScene(vmSceneRef.value!)
  return {
    lightingViewModel: lightingVm,
    sceneViewModel: { currentScene: ref({ id: SCENE_ID, name: 's1', title: 't' }) },
    currentProject: { value: { id: 'p1' } },
  } as unknown as EditorViewModel
}

let pinia: Pinia
let wrapper: VueWrapper | undefined

beforeEach(() => {
  vi.clearAllMocks()
  getLightingMock.mockReset()
  updateLightingMock.mockReset()
  setSunLightMock.mockReset()
  getLightingMock.mockResolvedValue(okApiResponse({ ...BACKEND_CONFIG }))
  updateLightingMock.mockResolvedValue(okApiResponse({ ...BACKEND_CONFIG }))
  vmSceneRef.value = SCENE_ID
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => {
  // 必须先 dispose VM（停掉场景 watch），再恢复真实计时器，
  // 否则 watch 持有的响应式依赖会在后续测试中触发已废弃的 loadForScene
  activeLightingVm?.dispose()
  activeLightingVm = null
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

/** 挂载面板，等待 VM 场景 watch 完成回填，并启用假定时器 */
async function mountPanel(): Promise<void> {
  wrapper = mount(LightingPanel, {
    props: { vm: makeVm() },
    attachTo: document.body,
    global: {
      plugins: [pinia],
      components: {
        'el-slider': SliderStub,
        'el-switch': SwitchStub,
        'el-color-picker': EmptyStub,
        'el-upload': EmptyStub,
        'el-button': EmptyStub,
      },
    },
  })
  await flushPromises()
  await flushPromises()
  vi.useFakeTimers()
}

/** 驱动受控 input（stub 根元素即 input，data-testid 经属性透传落在其上） */
function driveInput(testId: string, value: number | boolean): void {
  const el = document.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement | null
  if (!el) throw new Error(`未找到受控 input: ${testId}`)
  const isCheckbox = el.type === 'checkbox'
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    isCheckbox ? 'checked' : 'value',
  )!.set!
  setter.call(el, value as never)
  el.dispatchEvent(new Event(isCheckbox ? 'change' : 'input', { bubbles: true }))
}

describe('LightingPanel 太阳光部分更新（防旧方向覆盖 gizmo 拖拽结果）', () => {
  it('调强度后 PUT 只携带 sunIntensity，不携带方位角/仰角', async () => {
    await mountPanel()
    expect(getLightingMock).toHaveBeenCalledWith(SCENE_ID)

    driveInput('sun-intensity-slider', 5)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(updateLightingMock).toHaveBeenCalledTimes(1)
    const [sceneId, params] = updateLightingMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(sceneId).toBe(SCENE_ID)
    expect(params.sunIntensity).toBe(5)
    // 核心回归断言：方位角/仰角绝不能随强度更新下发
    expect(params).not.toHaveProperty('sunAzimuth')
    expect(params).not.toHaveProperty('sunElevation')
    expect(params).not.toHaveProperty('sunEnabled')
    expect(params).not.toHaveProperty('sunColor')
    expect(params).not.toHaveProperty('envMapUrl')
  })

  it('调方位角后 PUT 只携带 sunAzimuth', async () => {
    await mountPanel()

    driveInput('sun-azimuth-slider', 200)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(updateLightingMock).toHaveBeenCalledTimes(1)
    const [, params] = updateLightingMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(params).toEqual({ sunAzimuth: 200 })
  })

  it('调仰角后 PUT 只携带 sunElevation', async () => {
    await mountPanel()

    driveInput('sun-elevation-slider', 55)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(updateLightingMock).toHaveBeenCalledTimes(1)
    const [, params] = updateLightingMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(params).toEqual({ sunElevation: 55 })
  })

  it('开关变化后 PUT 只携带 sunEnabled', async () => {
    await mountPanel()

    driveInput('sun-enabled-switch', false)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(updateLightingMock).toHaveBeenCalledTimes(1)
    const [, params] = updateLightingMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(params).toEqual({ sunEnabled: false })
  })

  it('连续调节多个字段（300ms 内先强度后方位角）防抖合并为一次 PUT，携带两个变更键', async () => {
    await mountPanel()

    driveInput('sun-intensity-slider', 5)
    // 不推进防抖定时器，直接第二次调节（模拟用户 300ms 内连续操作）
    driveInput('sun-azimuth-slider', 200)

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(updateLightingMock).toHaveBeenCalledTimes(1)
    const [, params] = updateLightingMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(params).toEqual({ sunIntensity: 5, sunAzimuth: 200 })
  })

  it('切换场景后丢弃上一场景的待持久化字段（场景守卫）', async () => {
    await mountPanel()

    // 场景 A 上调强度，防抖定时器尚未触发
    driveInput('sun-intensity-slider', 5)

    // 切换当前场景（VM watch 场景 id 应清掉待写字段与定时器）
    vmSceneRef.value = 'scene-2'
    await flushPromises()
    await flushPromises()

    // 即使推进时间，也不应对任何场景发出旧字段的 PUT
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()

    expect(updateLightingMock).not.toHaveBeenCalled()
  })
})

describe('LightingPanel 引擎实时预览', () => {
  it('调强度时引擎收到完整太阳光配置（含当前方位角/仰角），不受持久化防抖影响', async () => {
    await mountPanel()
    // attachEngine + 场景加载各推送一次，此后只统计本次交互
    setSunLightMock.mockClear()

    driveInput('sun-intensity-slider', 5)

    expect(setSunLightMock).toHaveBeenCalledTimes(1)
    expect(setSunLightMock).toHaveBeenCalledWith({
      enabled: true,
      azimuth: 100,
      elevation: 30,
      intensity: 5,
      color: '#ffffff',
    })
  })
})

describe('LightingPanel gizmo 拖拽联动（MVC：状态在 VM，滑块自动跟随）', () => {
  it('VM.setSunDirection 后滑块显示新方位角/仰角，后续调强度以新方向预览且持久化不带旧方向', async () => {
    await mountPanel()
    setSunLightMock.mockClear()

    const lightingVm = (wrapper!.props('vm') as EditorViewModel).lightingViewModel

    // 画布 gizmo 拖拽（含负角归一化）：直接驱动 VM（View 层只读状态）
    lightingVm.setSunDirection(-40, 50, { persist: false })
    await flushPromises()

    // 滑块显示已跟随新方向（-40 归一化为 320）
    const az = document.querySelector('[data-testid="sun-azimuth-slider"]') as HTMLInputElement
    const el = document.querySelector('[data-testid="sun-elevation-slider"]') as HTMLInputElement
    expect(Number(az.value)).toBe(320)
    expect(Number(el.value)).toBe(50)

    // 此时调强度：引擎预览用新方向；持久化只发 sunIntensity
    driveInput('sun-intensity-slider', 4)
    expect(setSunLightMock).toHaveBeenCalledWith({
      enabled: true,
      azimuth: 320,
      elevation: 50,
      intensity: 4,
      color: '#ffffff',
    })
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    const [, params] = updateLightingMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(params).toEqual({ sunIntensity: 4 })
  })
})
