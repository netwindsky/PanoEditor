import { describe, it, expect } from 'vitest'
import {
  toSunConfig,
  toSunFields,
  envMapFileName,
  buildSunUpdate,
  normalizeAzimuth,
  mergeSunConfig,
} from '@/api/lighting'
import type { LightingConfig } from '@/types'

describe('api/lighting 纯函数映射', () => {
  const lighting: LightingConfig = {
    id: 'l1',
    sceneId: 's1',
    envMapUrl: '/uploads/projects/p1/env/sky.hdr',
    sunEnabled: true,
    sunAzimuth: 200,
    sunElevation: 45,
    sunIntensity: 2.5,
    sunColor: '#fff2cc',
  }

  it('toSunConfig 去掉 sun 前缀并保留全部太阳光字段', () => {
    const sun = toSunConfig(lighting)
    expect(sun).toEqual({
      enabled: true,
      azimuth: 200,
      elevation: 45,
      intensity: 2.5,
      color: '#fff2cc',
    })
  })

  it('toSunConfig 接受仅含太阳光子集的对象（表单模型）', () => {
    const sun = toSunConfig({
      sunEnabled: false,
      sunAzimuth: 0,
      sunElevation: -90,
      sunIntensity: 0,
      sunColor: '#000000',
    })
    expect(sun.enabled).toBe(false)
    expect(sun.azimuth).toBe(0)
    expect(sun.elevation).toBe(-90)
  })

  it('envMapFileName 从 URL 提取文件名', () => {
    expect(envMapFileName('/uploads/projects/p1/env/sky.hdr')).toBe('sky.hdr')
  })

  it('envMapFileName 对 null/空返回空字符串', () => {
    expect(envMapFileName(null)).toBe('')
  })

  it('envMapFileName 对 URL 编码文件名做解码', () => {
    expect(envMapFileName('/uploads/x/%E5%A4%A9%E7%A9%BA.hdr')).toBe('天空.hdr')
  })
})

describe('buildSunUpdate 部分更新参数（防表单旧值覆盖引擎快照）', () => {
  const form = {
    envMapUrl: '/uploads/env.hdr',
    sunEnabled: true,
    sunAzimuth: 300,
    sunElevation: 40,
    sunIntensity: 2.5,
    sunColor: '#fff2cc',
  }

  it('调强度只下发强度（不带表单方位角/仰角，防止覆盖 gizmo 拖拽后的新值）', () => {
    expect(buildSunUpdate(form, ['sunIntensity'])).toEqual({ sunIntensity: 2.5 })
  })

  it('调方位角只下发方位角', () => {
    expect(buildSunUpdate(form, ['sunAzimuth'])).toEqual({ sunAzimuth: 300 })
  })

  it('调仰角只下发仰角', () => {
    expect(buildSunUpdate(form, ['sunElevation'])).toEqual({ sunElevation: 40 })
  })

  it('开关变化只下发 sunEnabled', () => {
    expect(buildSunUpdate(form, ['sunEnabled'])).toEqual({ sunEnabled: true })
  })

  it('颜色变化只下发 sunColor', () => {
    expect(buildSunUpdate(form, ['sunColor'])).toEqual({ sunColor: '#fff2cc' })
  })

  it('多个字段变化时取并集', () => {
    expect(buildSunUpdate(form, ['sunIntensity', 'sunColor'])).toEqual({
      sunIntensity: 2.5,
      sunColor: '#fff2cc',
    })
  })

  it('无变化字段返回空参数（envMapUrl 单独持久化，不在此列）', () => {
    expect(buildSunUpdate(form, [])).toEqual({})
  })

  it('重复键去重', () => {
    expect(buildSunUpdate(form, ['sunIntensity', 'sunIntensity'])).toEqual({
      sunIntensity: 2.5,
    })
  })
})

describe('normalizeAzimuth 方位角归一化', () => {
  it('负角度转为 [0,360) 等价值（-138 → 222）', () => {
    expect(normalizeAzimuth(-138)).toBe(222)
  })

  it('恰好 360 归一化为 0', () => {
    expect(normalizeAzimuth(360)).toBe(0)
  })

  it('超一圈角度折回（450 → 90）', () => {
    expect(normalizeAzimuth(450)).toBe(90)
  })

  it('常规角度保持不变', () => {
    expect(normalizeAzimuth(135)).toBe(135)
  })

  it('极小负数归一化为 360 附近（-0.5 → 359.5）', () => {
    expect(normalizeAzimuth(-0.5)).toBeCloseTo(359.5, 6)
  })
})

describe('toSunFields 引擎配置 → 后端字段', () => {
  it('加回 sun 前缀（toSunConfig 的逆映射）', () => {
    expect(
      toSunFields({
        enabled: true,
        azimuth: 222,
        elevation: 10,
        intensity: 1.5,
        color: '#fff2d0',
      }),
    ).toEqual({
      sunEnabled: true,
      sunAzimuth: 222,
      sunElevation: 10,
      sunIntensity: 1.5,
      sunColor: '#fff2d0',
    })
  })
})

describe('mergeSunConfig 补丁合并（面板部分字段更新不覆盖引擎方向）', () => {
  const current = {
    enabled: true,
    azimuth: 222,
    elevation: 35,
    intensity: 1.5,
    color: '#fff2d0',
  }

  it('只改强度：方位/仰角/颜色/开关保留引擎当前值', () => {
    expect(mergeSunConfig(current, { intensity: 3 })).toEqual({
      enabled: true,
      azimuth: 222,
      elevation: 35,
      intensity: 3,
      color: '#fff2d0',
    })
  })

  it('只改开关：方向保留', () => {
    const merged = mergeSunConfig(current, { enabled: false })
    expect(merged.enabled).toBe(false)
    expect(merged.azimuth).toBe(222)
    expect(merged.elevation).toBe(35)
  })

  it('只改方向：强度/颜色保留', () => {
    const merged = mergeSunConfig(current, { azimuth: 10, elevation: -20 })
    expect(merged.azimuth).toBe(10)
    expect(merged.elevation).toBe(-20)
    expect(merged.intensity).toBe(1.5)
    expect(merged.color).toBe('#fff2d0')
  })

  it('引擎无配置（null）时用 fallback 补齐未提供字段', () => {
    const fallback = {
      enabled: false,
      azimuth: 180,
      elevation: 30,
      intensity: 1,
      color: '#ffffff',
    }
    expect(mergeSunConfig(null, { intensity: 2 }, fallback)).toEqual({
      enabled: false,
      azimuth: 180,
      elevation: 30,
      intensity: 2,
      color: '#ffffff',
    })
  })

  it('方位角补丁被归一化（-90 → 270）', () => {
    expect(mergeSunConfig(current, { azimuth: -90 }).azimuth).toBe(270)
  })

  it('仰角补丁被钳位到 [-90,90]（120 → 90）', () => {
    expect(mergeSunConfig(current, { elevation: 120 }).elevation).toBe(90)
  })
})
