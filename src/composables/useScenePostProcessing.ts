import { watch, toValue, type MaybeRefOrGetter } from 'vue'
import { getPostProcessing } from '@/api/postprocessing'
import { getAllLuts } from '@/api/lut'
import type { PanoEngineAdapter } from '@/utils/PanoEngineAdapter'

/**
 * 无后期配置 / 加载失败时下发给引擎的安全默认值：
 * 显式关闭后期通道，避免切场景后沿用上一个场景的暗角、泛光等效果。
 */
const DEFAULT_CONFIG = {
  presetStyle: 'original',
  lutResourceId: null as string | null,
  lutFileUrl: null as string | null,
  lutIntensity: 1,
  exposure: 1,
  contrast: 1,
  saturation: 1,
  colorTemperature: 0,
  vignette: 0,
  vignetteIntensity: 1,
  bloomStrength: 0,
  bloomThreshold: 0.8,
  bloomRadius: 0.5,
}

/**
 * 编辑器常驻后期加载层。
 *
 * 后期配置原先只在 PostProcessingPanel（右侧面板 v-if 懒挂载）中加载，
 * 刷新页面后默认停留在「场景」分区时没有任何实体把持久化配置下发引擎，
 * 表现为「输入框数值正确、画面零效果」。本 composable 由常驻的
 * EditorCanvas 持有：当前场景或引擎适配器就绪/变化时，自动拉取该场景的
 * 后期配置并应用到引擎。
 *
 * 竞态保护：快速切换场景或引擎重建时，仅最后一次请求的结果允许下发，
 * 旧场景迟到的响应不会覆盖新场景。
 */
export function useScenePostProcessing(
  sceneIdSource: MaybeRefOrGetter<string | null | undefined>,
  adapterSource: MaybeRefOrGetter<PanoEngineAdapter | null>,
) {
  let requestSeq = 0

  async function loadAndApply(): Promise<void> {
    const sceneId = toValue(sceneIdSource)
    const adapter = toValue(adapterSource)
    if (!sceneId || !adapter) return

    const seq = ++requestSeq
    try {
      const res = await getPostProcessing(sceneId)
      const d = res?.data?.data
      if (seq !== requestSeq) return

      if (!d) {
        adapter.applyPostConfig({ enabled: false, ...DEFAULT_CONFIG })
        return
      }

      let lutFileUrl: string | null = null
      if (d.lutResourceId) {
        try {
          const lutRes = await getAllLuts()
          if (seq !== requestSeq) return
          const list = lutRes?.data?.data
          const hit = Array.isArray(list)
            ? list.find((l: { id?: string }) => l.id === d.lutResourceId)
            : null
          lutFileUrl = hit?.fileUrl || null
        } catch {
          lutFileUrl = null
        }
      }

      adapter.applyPostConfig({
        enabled: d.enabled ?? true,
        presetStyle: d.presetStyle || 'original',
        exposure: d.exposure ?? 1,
        contrast: d.contrast ?? 1,
        saturation: d.saturation ?? 1,
        colorTemperature: d.colorTemperature ?? 0,
        vignette: d.vignette ?? 0,
        vignetteIntensity: d.vignetteIntensity ?? 1,
        lutResourceId: d.lutResourceId || null,
        lutFileUrl,
        lutIntensity: d.lutIntensity ?? 1,
        bloomStrength: d.bloomStrength ?? 0,
        bloomThreshold: d.bloomThreshold ?? 0.8,
        bloomRadius: d.bloomRadius ?? 0.5,
      })
    } catch (e) {
      if (seq !== requestSeq) return
      console.error('加载场景后期处理配置失败:', e)
      adapter.applyPostConfig({ enabled: false, ...DEFAULT_CONFIG })
    }
  }

  watch(
    [() => toValue(sceneIdSource), () => toValue(adapterSource)],
    () => {
      void loadAndApply()
    },
    { immediate: true },
  )

  return { reload: loadAndApply }
}
