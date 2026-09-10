import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { LightingViewModel } from './LightingViewModel'
import type { LightingConfig } from '@/types'
import type { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'

/**
 * LightingViewModel（太阳光照 Model 层）TDD 测试。
 *
 * 核心契约：引擎、面板滑块、DB 三方共享 VM 单一状态；
 * 任一视图（gizmo 拖拽 / 面板滑块）修改，其余视图自动跟随。
 */

// --- Mock API ---
const mockGetLighting = vi.fn()
const mockUpdateLighting = vi.fn()

vi.mock('@/api/lighting', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/lighting')>()
  return {
    ...actual,
    getLighting: (...args: unknown[]) => mockGetLighting(...args),
    updateLighting: (...args: unknown[]) => mockUpdateLighting(...args),
  }
})

// --- Mock 资源上传（环境贴图上传用） ---
const mockUploadResource = vi.fn()
vi.mock('@/api/resource', () => ({
  uploadResource: (...args: unknown[]) => mockUploadResource(...args),
}))

function makeLighting(overrides: Partial<LightingConfig> = {}): LightingConfig {
  return {
    id: 'l1',
    sceneId: 's1',
    envMapUrl: null,
    sunEnabled: false,
    sunAzimuth: 180,
    sunElevation: 30,
    sunIntensity: 1,
    sunColor: '#ffffff',
    ...overrides,
  }
}

function makeAdapter(): Pick<
  PanoEngineAdapter,
  'setSunLight' | 'getSunLightConfig' | 'setEnvironmentMap'
> {
  return {
    setSunLight: vi.fn(),
    getSunLightConfig: vi.fn(() => null),
    setEnvironmentMap: vi.fn(() => Promise.resolve()),
  }
}

/** 构造已注入 mock 引擎的 VM */
function makeVm(opts: {
  adapter?: ReturnType<typeof makeAdapter> | null
  sceneId?: string | null
  projectId?: string | null
} = {}) {
  const adapter = opts.adapter === undefined ? makeAdapter() : opts.adapter
  // 响应式场景 id 供给（与生产中 sceneViewModel.currentScene 为真 ref 一致），
  // 场景切换用例通过改写它触发 VM 内部的 watch
  const sceneIdRef = ref<string | null>(opts.sceneId === undefined ? 's1' : opts.sceneId)
  const vm = new LightingViewModel({
    getSceneId: () => sceneIdRef.value,
    getProjectId: () => opts.projectId ?? 'p1',
    onDirty: vi.fn(),
  })
  if (adapter) vm.attachEngine(adapter as PanoEngineAdapter)
  return { vm, adapter, sceneRef: sceneIdRef }
}

beforeEach(() => {
  mockGetLighting.mockReset()
  mockUpdateLighting.mockReset().mockResolvedValue({ data: { data: makeLighting() } })
  mockUploadResource.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('loadForScene：后端配置 → VM 状态 → 引擎', () => {
  it('拉取配置填充状态并把 sun + env 应用到引擎', async () => {
    const { vm, adapter } = makeVm()
    mockGetLighting.mockResolvedValue({
      data: {
        data: makeLighting({
          envMapUrl: '/uploads/env.hdr',
          sunEnabled: true,
          sunAzimuth: 222,
          sunElevation: 35,
          sunIntensity: 1.5,
          sunColor: '#fff2d0',
        }),
      },
    })

    await vm.loadForScene('s1')

    expect(vm.sunConfig.value).toMatchObject({
      enabled: true,
      azimuth: 222,
      elevation: 35,
      intensity: 1.5,
      color: '#fff2d0',
    })
    expect(vm.envMapUrl.value).toBe('/uploads/env.hdr')
    // 环境贴图 + 太阳都推给引擎
    expect(adapter!.setEnvironmentMap).toHaveBeenCalledWith('/uploads/env.hdr')
    expect(adapter!.setSunLight).toHaveBeenCalledWith({
      enabled: true,
      azimuth: 222,
      elevation: 35,
      intensity: 1.5,
      color: '#fff2d0',
    })
  })

  it('接口失败时使用默认配置，不抛错', async () => {
    const { vm } = makeVm()
    mockGetLighting.mockRejectedValue(new Error('network'))

    await expect(vm.loadForScene('s1')).resolves.toBeUndefined()
    expect(vm.sunConfig.value.enabled).toBe(false)
    expect(vm.sunConfig.value.azimuth).toBe(180)
  })

  it('切换场景后重新拉取，旧场景未完成的持久化被丢弃', async () => {
    vi.useFakeTimers()
    const { vm, sceneRef } = makeVm({ sceneId: 's1' })
    // 场景 A：加载并修改强度（进入 300ms 防抖窗口）
    mockGetLighting.mockResolvedValue({ data: { data: makeLighting({ sunIntensity: 2 }) } })
    await vm.loadForScene('s1')
    vm.setSunFields({ intensity: 5 })
    expect(mockUpdateLighting).not.toHaveBeenCalled()

    // 切到场景 B（通过可变供给触发 VM 内部 watch → 自动 loadForScene + 丢弃待写）。
    // fake timers 下 vi.waitFor 会卡死：Vue watch 的异步回调依赖微任务 flush，手动驱动。
    mockGetLighting.mockResolvedValue({ data: { data: makeLighting({ sunIntensity: 1 }) } })
    sceneRef.value = 's2'
    await nextTick()
    await nextTick()
    await Promise.resolve()
    expect(vm.loadedSceneIdForTest()).toBe('s2')
    vi.advanceTimersByTime(400)
    // 场景守卫：捕获的场景 id 与当前不符 → 丢弃，不得写入
    expect(mockUpdateLighting).not.toHaveBeenCalledWith('s1', expect.anything())
  })
})

describe('setSunFields：面板部分字段更新（MVC：滑块 → 状态 → 引擎 + DB）', () => {
  it('调强度：引擎收到合并后完整配置（方向保留），DB 只收 sunIntensity', async () => {
    vi.useFakeTimers()
    const { vm, adapter } = makeVm()
    mockGetLighting.mockResolvedValue({
      data: { data: makeLighting({ sunEnabled: true, sunAzimuth: 222, sunElevation: 35, sunIntensity: 1.5 }) },
    })
    await vm.loadForScene('s1')
    adapter!.setSunLight.mockClear()

    vm.setSunFields({ intensity: 3 })

    // 状态更新（滑块绑 VM 状态会自动跟随）
    expect(vm.sunConfig.value.intensity).toBe(3)
    expect(vm.sunConfig.value.azimuth).toBe(222)
    // 引擎收到完整合并配置，方向未被覆盖
    expect(adapter!.setSunLight).toHaveBeenCalledWith({
      enabled: true,
      azimuth: 222,
      elevation: 35,
      intensity: 3,
      color: '#ffffff',
    })
    // 300ms 防抖后持久化：只发变更键
    vi.advanceTimersByTime(400)
    expect(mockUpdateLighting).toHaveBeenCalledWith('s1', { sunIntensity: 3 })
  })

  it('调方位角：归一化进状态与引擎', async () => {
    vi.useFakeTimers()
    const { vm } = makeVm()
    mockGetLighting.mockResolvedValue({ data: { data: makeLighting({ sunEnabled: true }) } })
    await vm.loadForScene('s1')

    vm.setSunFields({ azimuth: -90 })

    expect(vm.sunConfig.value.azimuth).toBe(270)
    vi.advanceTimersByTime(400)
    expect(mockUpdateLighting).toHaveBeenCalledWith('s1', expect.objectContaining({ sunAzimuth: 270 }))
  })

  it('连续多次修改合并为一次持久化', async () => {
    vi.useFakeTimers()
    const { vm } = makeVm()
    mockGetLighting.mockResolvedValue({ data: { data: makeLighting({ sunEnabled: true }) } })
    await vm.loadForScene('s1')

    vm.setSunFields({ intensity: 2 })
    vm.setSunFields({ color: '#aabbcc' })
    vm.setSunFields({ intensity: 4 })
    vi.advanceTimersByTime(400)

    expect(mockUpdateLighting).toHaveBeenCalledTimes(1)
    expect(mockUpdateLighting).toHaveBeenCalledWith('s1', { sunIntensity: 4, sunColor: '#aabbcc' })
  })
})

describe('setSunDirection：gizmo 拖拽（MVC：画布 → 状态 → 滑块跟随 + 引擎）', () => {
  it('拖拽中（persist=false）：更新状态与引擎，不触发持久化', () => {
    vi.useFakeTimers()
    const { vm, adapter } = makeVm()
    mockGetLighting.mockResolvedValue({ data: { data: makeLighting({ sunEnabled: true }) } })
    vm.loadForScene('s1')

    vm.setSunDirection(-138, 29.46, { persist: false })

    // 状态更新 → 面板滑块（绑 VM 状态）自动跟随；负角已归一化
    expect(vm.sunConfig.value.azimuth).toBeCloseTo(222, 6)
    expect(vm.sunConfig.value.elevation).toBeCloseTo(29.46, 6)
    // 引擎预览
    expect(adapter!.setSunLight).toHaveBeenCalledWith(
      expect.objectContaining({ azimuth: expect.closeTo(222, 3), elevation: 29.46 }),
    )
    vi.advanceTimersByTime(500)
    expect(mockUpdateLighting).not.toHaveBeenCalled()
  })

  it('松手（persist=true）：立即 PUT 只含方位角/仰角', async () => {
    const { vm } = makeVm()
    mockGetLighting.mockResolvedValue({ data: { data: makeLighting({ sunEnabled: true }) } })
    await vm.loadForScene('s1')
    mockUpdateLighting.mockClear()

    vm.setSunDirection(-10, 50, { persist: true })
    await vi.waitFor(() => expect(mockUpdateLighting).toHaveBeenCalled())

    expect(mockUpdateLighting).toHaveBeenCalledWith('s1', {
      sunAzimuth: 350,
      sunElevation: 50,
    })
  })

  it('太阳未启用时拖拽仍可更新引擎方向（gizmo 只在启用时显示，防御）', async () => {
    const { vm, adapter } = makeVm()
    mockGetLighting.mockResolvedValue({ data: { data: makeLighting({ sunEnabled: false }) } })
    await vm.loadForScene('s1')

    vm.setSunDirection(90, 20, { persist: false })
    expect(adapter!.setSunLight).toHaveBeenCalledWith(
      expect.objectContaining({ azimuth: 90, elevation: 20 }),
    )
  })
})

describe('attachEngine：引擎就绪接线（与配置加载顺序无关）', () => {
  it('先加载配置后引擎就绪：把已加载的状态推给引擎（env + sun）', async () => {
    const { vm } = makeVm({ adapter: null })
    mockGetLighting.mockResolvedValue({
      data: { data: makeLighting({ envMapUrl: '/uploads/e.hdr', sunEnabled: true, sunAzimuth: 100 }) },
    })
    await vm.loadForScene('s1')

    const adapter = makeAdapter()
    vm.attachEngine(adapter as PanoEngineAdapter)
    // attachEngine 内部 applyToEngine 为异步（env 加载 await）
    await vi.waitFor(() => expect(adapter.setSunLight).toHaveBeenCalled())

    expect(adapter.setEnvironmentMap).toHaveBeenCalledWith('/uploads/e.hdr')
    expect(adapter.setSunLight).toHaveBeenCalledWith(expect.objectContaining({ azimuth: 100 }))
  })

  it('引擎先就绪后配置加载完成：loadForScene 完成时推状态，后到覆盖', async () => {
    const { vm, adapter } = makeVm()
    mockGetLighting.mockResolvedValue({
      data: { data: makeLighting({ sunEnabled: true, sunAzimuth: 77 }) },
    })
    await vm.loadForScene('s1')

    expect(adapter!.setSunLight).toHaveBeenCalledWith(expect.objectContaining({ azimuth: 77 }))
  })
})

describe('setEnvMap：环境贴图（不触碰太阳配置）', () => {
  it('设置后立即持久化 envMapUrl，太阳字段不下发', async () => {
    const { vm, adapter } = makeVm()
    mockGetLighting.mockResolvedValue({ data: { data: makeLighting({ sunEnabled: true, sunAzimuth: 222 }) } })
    await vm.loadForScene('s1')
    mockUpdateLighting.mockClear()

    await vm.setEnvMap('/uploads/new.hdr')

    expect(vm.envMapUrl.value).toBe('/uploads/new.hdr')
    expect(adapter!.setEnvironmentMap).toHaveBeenCalledWith('/uploads/new.hdr')
    expect(mockUpdateLighting).toHaveBeenCalledWith('s1', { envMapUrl: '/uploads/new.hdr' })
  })

  it('移除：envMapUrl 置 null 持久化，引擎恢复默认环境', async () => {
    const { vm, adapter } = makeVm()
    mockGetLighting.mockResolvedValue({
      data: { data: makeLighting({ envMapUrl: '/uploads/e.hdr' }) },
    })
    await vm.loadForScene('s1')
    mockUpdateLighting.mockClear()

    await vm.setEnvMap(null)

    expect(vm.envMapUrl.value).toBeNull()
    expect(adapter!.setEnvironmentMap).toHaveBeenCalledWith(null)
    expect(mockUpdateLighting).toHaveBeenCalledWith('s1', { envMapUrl: null })
  })
})

describe('dispose', () => {
  it('清理场景 watch 与防抖定时器', async () => {
    vi.useFakeTimers()
    const { vm } = makeVm()
    mockGetLighting.mockResolvedValue({ data: { data: makeLighting() } })
    await vm.loadForScene('s1')
    vm.setSunFields({ intensity: 2 })
    vm.dispose()
    vi.advanceTimersByTime(500)
    expect(mockUpdateLighting).not.toHaveBeenCalled()
    await nextTick()
  })
})
