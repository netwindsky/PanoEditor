import { describe, it, expect } from 'vitest'
import { exportToKrpanoXml } from '@/utils/xmlExport'
import type { Scene, Hotspot, Project, TourSettings, OverlayLayer } from '@/types'

function makeProject(): Project {
  return { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 0, createdAt: '', updatedAt: '' }
}

function makeSettings(layers: OverlayLayer[] = []): TourSettings & { layers?: OverlayLayer[] } {
  return {
    autoRotate: false,
    autoRotateSpeed: 1,
    defaultFov: 100,
    minFov: 50,
    maxFov: 150,
    enableCompass: false,
    controlbar: true,
    thumbs: true,
    tooltips: true,
    designStyle: 'flat',
    loadsceneBlend: '',
    layers,
  } as TourSettings & { layers?: OverlayLayer[] }
}

describe('exportToKrpanoXml — Layer 导出', () => {
  it('导出 text 类型 layer 标签', () => {
    const layers: OverlayLayer[] = [
      { id: 'l1', name: 'infotext', type: 'text', html: '欢迎', css: 'color:#FFF;', align: 'left', x: 10, visible: true },
    ]
    const xml = exportToKrpanoXml(makeProject(), [], makeSettings(layers))
    expect(xml).toContain('<layer ')
    expect(xml).toContain('name="infotext"')
    expect(xml).toContain('type="text"')
    expect(xml).toContain('html=')
  })

  it('导出 button 类型 layer 标签', () => {
    const layers: OverlayLayer[] = [
      { id: 'l2', name: 'gyrobutton', type: 'button', url: 'gyroicon.png', scale: 0.5, align: 'right', x: 10, visible: false, onclick: 'switch(enabled);' },
    ]
    const xml = exportToKrpanoXml(makeProject(), [], makeSettings(layers))
    expect(xml).toContain('<layer ')
    expect(xml).toContain('name="gyrobutton"')
    expect(xml).toContain('url="gyroicon.png"')
    expect(xml).toContain('scale="0.5"')
    expect(xml).toContain('visible="false"')
    expect(xml).toContain('onclick=')
  })

  it('visible=false 的 layer 仍导出（含 visible 属性）', () => {
    const layers: OverlayLayer[] = [
      { id: 'l3', name: 'hidden', type: 'text', html: '', visible: false },
    ]
    const xml = exportToKrpanoXml(makeProject(), [], makeSettings(layers))
    expect(xml).toContain('visible="false"')
  })

  it('无 layers 时不导出任何 layer 标签', () => {
    const xml = exportToKrpanoXml(makeProject(), [], makeSettings([]))
    expect(xml).not.toContain('<layer ')
  })

  it('layer 含 align/x/y 属性', () => {
    const layers: OverlayLayer[] = [
      { id: 'l4', name: 'box', type: 'container', align: 'lefttop', x: 20, y: 30, visible: true },
    ]
    const xml = exportToKrpanoXml(makeProject(), [], makeSettings(layers))
    expect(xml).toContain('align="lefttop"')
    expect(xml).toContain('x="20"')
    expect(xml).toContain('y="30"')
  })
})
