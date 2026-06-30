import { describe, it, expect } from 'vitest'
import { exportToKrpanoXml } from '@/utils/xmlExport'
import type { Scene, Hotspot, Project, TourSettings } from '@/types'

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 's1',
    projectId: 'p1',
    name: 'scene1',
    title: '场景一',
    previewUrl: '/preview/s1.jpg',
    thumbUrl: '/thumb/s1.jpg',
    imageConfig: '',
    status: 'COMPLETED',
    initialView: { hfov: 100, pitch: 0, yaw: 0, fovMin: 50, fovMax: 150, limitView: 'auto', fovType: 'MFOV' },
    sortOrder: 0,
    viewConfig: JSON.stringify({ lat: 30.5, lng: 120.3, heading: 45, onstart: 'loadscene();' }),
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function makeHotspot(overrides: Partial<Hotspot> = {}): Hotspot {
  return {
    id: 'h1',
    sceneId: 's1',
    name: 'hotspot1',
    type: 'image',
    ath: 45,
    atv: 10,
    url: '/hotspot.png',
    style: 'info-icon',
    linkedSceneId: 's2',
    tooltip: '点击跳转',
    onclick: 'js(loadScene("s2"))',
    ...overrides,
  }
}

function makeTourSettings(overrides: Partial<TourSettings> = {}): TourSettings {
  return {
    autoRotate: true,
    autoRotateSpeed: 1.0,
    defaultFov: 100,
    minFov: 50,
    maxFov: 150,
    enableCompass: false,
    controlbar: true,
    thumbs: true,
    tooltips: true,
    designStyle: 'flat',
    loadsceneBlend: 'BLEND(1, easeOutCubic)',
    ...overrides,
  }
}

describe('exportToKrpanoXml — XML 导出工具', () => {
  it('生成合法的 krpano XML 根节点', () => {
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 0, createdAt: '', updatedAt: '' },
      [],
      makeTourSettings(),
    )

    expect(xml).toContain('<krpano')
    expect(xml).toContain('</krpano>')
    expect(xml).toContain('version=')
  })

  it('生成 skin_settings 标签含配置', () => {
    const settings = makeTourSettings({ controlbar: false, thumbs: false, tooltips: false })
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 0, createdAt: '', updatedAt: '' },
      [],
      settings,
    )

    expect(xml).toContain('<skin_settings')
    expect(xml).toContain('controlbar="false"')
    expect(xml).toContain('thumbs="false"')
    expect(xml).toContain('tooltips="false"')
  })

  it('生成 scene 标签含 name/title/thumburl', () => {
    const scenes = [makeScene({ name: 'scene1', title: '场景一', thumbUrl: '/thumb/s1.jpg' })]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      makeTourSettings(),
    )

    expect(xml).toContain('<scene ')
    expect(xml).toContain('name="scene1"')
    expect(xml).toContain('title="场景一"')
    expect(xml).toContain('thumburl="/thumb/s1.jpg"')
  })

  it('scene 标签含 GPS lat/lng/heading 从 viewConfig', () => {
    const scenes = [makeScene()]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      makeTourSettings(),
    )

    expect(xml).toContain('lat="30.5"')
    expect(xml).toContain('lng="120.3"')
    expect(xml).toContain('heading="45"')
  })

  it('scene 含 view 标签含 hlookat/vlookat/fov/fovmin/fovmax', () => {
    const scenes = [makeScene({
      initialView: { hfov: 120, pitch: -5, yaw: 30, fovMin: 60, fovMax: 140, limitView: 'range', fovType: 'VFOV' },
    })]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      makeTourSettings(),
    )

    expect(xml).toContain('<view ')
    expect(xml).toContain('hlookat="30"')
    expect(xml).toContain('vlookat="-5"')
    expect(xml).toContain('fov="120"')
    expect(xml).toContain('fovmin="60"')
    expect(xml).toContain('fovmax="140"')
    expect(xml).toContain('limitview="range"')
    expect(xml).toContain('fovtype="VFOV"')
  })

  it('scene 含 hotspot 标签含 name/ath/atv/style', () => {
    const scenes = [makeScene()]
    const hotspots = [makeHotspot({ name: 'spot1', ath: 45, atv: 10, style: 'info-icon' })]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      makeTourSettings(),
      hotspots,
    )

    expect(xml).toContain('<hotspot ')
    expect(xml).toContain('name="spot1"')
    expect(xml).toContain('ath="45"')
    expect(xml).toContain('atv="10"')
    expect(xml).toContain('style="info-icon"')
  })

  it('hotspot 含 linkedscene/tooltip/onclick', () => {
    const scenes = [makeScene()]
    const hotspots = [makeHotspot({
      linkedSceneId: 's2',
      tooltip: '去场景2',
      onclick: 'js(loadScene("s2"))',
    })]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      makeTourSettings(),
      hotspots,
    )

    expect(xml).toContain('linkedscene="s2"')
    expect(xml).toContain('tooltip="去场景2"')
    expect(xml).toContain('onclick="js(loadScene(&quot;s2&quot;))"')
  })

  it('hotspot 含 shader 属性', () => {
    const scenes = [makeScene()]
    const hotspots = [makeHotspot({ shader: 'grayscale' } as any)]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      makeTourSettings(),
      hotspots,
    )

    expect(xml).toContain('shader="grayscale"')
  })

  it('hotspot 含 events 属性', () => {
    const scenes = [makeScene()]
    const hotspots = [makeHotspot({ events: '{"click":"myFunc()"}' } as any)]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      makeTourSettings(),
      hotspots,
    )

    expect(xml).toContain('events=')
  })

  it('含 startup action 含 loadscene_blend', () => {
    const settings = makeTourSettings({ loadsceneBlend: 'BLEND(2, easeInOutCubic)' })
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 0, createdAt: '', updatedAt: '' },
      [],
      settings,
    )

    expect(xml).toContain('<action')
    expect(xml).toContain('startup')
    expect(xml).toContain('BLEND(2, easeInOutCubic)')
  })

  it('多场景按 sortOrder 排序', () => {
    const scenes = [
      makeScene({ id: 's2', name: 'scene2', sortOrder: 1 }),
      makeScene({ id: 's1', name: 'scene1', sortOrder: 0 }),
    ]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 2, createdAt: '', updatedAt: '' },
      scenes,
      makeTourSettings(),
    )

    const idx1 = xml.indexOf('name="scene1"')
    const idx2 = xml.indexOf('name="scene2"')
    expect(idx1).toBeGreaterThan(-1)
    expect(idx2).toBeGreaterThan(-1)
    expect(idx1).toBeLessThan(idx2)
  })
})
