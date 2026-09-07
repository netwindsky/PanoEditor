import { describe, it, expect } from 'vitest'
import { toSunConfig, envMapFileName } from '@/api/lighting'
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
