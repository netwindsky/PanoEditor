/**
 * useScenePostProcessing —— 编辑器常驻后期加载层测试
 *
 * 背景：后期配置原本只在 PostProcessingPanel（右侧面板 v-if 懒挂载）中加载，
 * 刷新后默认停留在「场景」分区时没有任何实体把持久化配置下发引擎，导致
 * 「输入框数值正确、画面零效果」。本 composable 由常驻的 EditorCanvas 持有，
 * 在场景与引擎适配器就绪后自动加载并应用配置。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useScenePostProcessing } from '@/composables/useScenePostProcessing'
import { flushPromises } from '@vue/test-utils'

const mockGetPostProcessing = vi.fn()
const mockGetAllLuts = vi.fn()

vi.mock('@/api/postprocessing', () => ({
  getPostProcessing: (...args: unknown[]) => mockGetPostProcessing(...args),
}))

vi.mock('@/api/lut', () => ({
  getAllLuts: (...args: unknown[]) => mockGetAllLuts(...args),
}))

function makeAdapter() {
  return { applyPostConfig: vi.fn() } as any
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pp-1',
    sceneId: 'scene-1',
    presetStyle: 'custom',
    lutResourceId: null,
    lutIntensity: 1,
    toneMapping: 'none',
    exposure: 1,
    contrast: 1,
    saturation: 1,
    colorTemperature: 0,
    vignette: 0.5,
    vignetteIntensity: 0.4,
    bloomStrength: 1.8,
    bloomThreshold: 0.7,
    bloomRadius: 0.8,
    enabled: true,
    ...overrides,
  }
}

describe('useScenePostProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPostProcessing.mockResolvedValue({ data: { data: makeConfig() } })
    mockGetAllLuts.mockResolvedValue({ data: { data: [] } })
  })

  it('场景与适配器就绪后自动加载并把暗角等参数下发引擎', async () => {
    const sceneId = ref('scene-1')
    const adapter = ref(makeAdapter())

    useScenePostProcessing(sceneId, adapter)
    await flushPromises()

    expect(mockGetPostProcessing).toHaveBeenCalledWith('scene-1')
    const cfg = adapter.value.applyPostConfig.mock.calls[0][0]
    expect(cfg.enabled).toBe(true)
    expect(cfg.vignette).toBe(0.5)
    expect(cfg.vignetteIntensity).toBe(0.4)
    expect(cfg.bloomStrength).toBe(1.8)
    expect(cfg.bloomThreshold).toBe(0.7)
    expect(cfg.bloomRadius).toBe(0.8)
  })

  it('适配器晚就绪时在其出现后补发（引擎初始化慢于场景数据）', async () => {
    const sceneId = ref('scene-1')
    const adapter = ref<{ applyPostConfig: ReturnType<typeof vi.fn> } | null>(null)

    useScenePostProcessing(sceneId, adapter)
    await flushPromises()
    expect(mockGetPostProcessing).not.toHaveBeenCalled()

    adapter.value = makeAdapter()
    await flushPromises()

    expect(mockGetPostProcessing).toHaveBeenCalledWith('scene-1')
    expect(adapter.value.applyPostConfig).toHaveBeenCalled()
  })

  it('切换场景后按新 sceneId 重新加载并应用', async () => {
    const sceneId = ref('scene-1')
    const adapter = ref(makeAdapter())

    useScenePostProcessing(sceneId, adapter)
    await flushPromises()

    mockGetPostProcessing.mockResolvedValue({
      data: { data: makeConfig({ sceneId: 'scene-2', vignette: 0.2, vignetteIntensity: 0.9 }) },
    })
    sceneId.value = 'scene-2'
    await flushPromises()

    expect(mockGetPostProcessing).toHaveBeenLastCalledWith('scene-2')
    const lastCfg = adapter.value.applyPostConfig.mock.calls.at(-1)![0]
    expect(lastCfg.vignette).toBe(0.2)
    expect(lastCfg.vignetteIntensity).toBe(0.9)
  })

  it('旧场景请求晚返回时不得覆盖新场景效果（竞态保护）', async () => {
    const sceneId = ref('scene-1')
    const adapter = ref(makeAdapter())

    // scene-1 的请求挂起不返回
    let resolveOld: (v: unknown) => void = () => {}
    mockGetPostProcessing.mockImplementationOnce(
      () => new Promise((resolve) => (resolveOld = resolve)),
    )

    useScenePostProcessing(sceneId, adapter)
    await flushPromises()

    mockGetPostProcessing.mockResolvedValue({
      data: { data: makeConfig({ sceneId: 'scene-2', vignette: 0.2 }) },
    })
    sceneId.value = 'scene-2'
    await flushPromises()
    const callsAfterScene2 = adapter.value.applyPostConfig.mock.calls.length

    // 旧请求此时才返回
    resolveOld({ data: { data: makeConfig({ sceneId: 'scene-1', vignette: 0.9 }) } })
    await flushPromises()

    expect(adapter.value.applyPostConfig.mock.calls.length).toBe(callsAfterScene2)
    const lastCfg = adapter.value.applyPostConfig.mock.calls.at(-1)![0]
    expect(lastCfg.vignette).toBe(0.2)
  })

  it('配置不存在或加载失败时禁用后期，避免沿用上一场景效果', async () => {
    const sceneId = ref('scene-x')
    const adapter = ref(makeAdapter())
    mockGetPostProcessing.mockRejectedValue(new Error('404'))

    useScenePostProcessing(sceneId, adapter)
    await flushPromises()

    const cfg = adapter.value.applyPostConfig.mock.calls[0][0]
    expect(cfg.enabled).toBe(false)
    expect(cfg.vignette).toBe(0)
  })

  it('配置引用 LUT 资源时解析其 fileUrl 一并下发', async () => {
    mockGetPostProcessing.mockResolvedValue({
      data: { data: makeConfig({ lutResourceId: 'lut-9', lutIntensity: 0.6 }) },
    })
    mockGetAllLuts.mockResolvedValue({
      data: { data: [{ id: 'lut-9', name: 'film.cube', fileUrl: '/uploads/lut-9.cube' }] },
    })
    const sceneId = ref('scene-1')
    const adapter = ref(makeAdapter())

    useScenePostProcessing(sceneId, adapter)
    await flushPromises()

    const cfg = adapter.value.applyPostConfig.mock.calls[0][0]
    expect(cfg.lutResourceId).toBe('lut-9')
    expect(cfg.lutFileUrl).toBe('/uploads/lut-9.cube')
    expect(cfg.lutIntensity).toBe(0.6)
  })
})
