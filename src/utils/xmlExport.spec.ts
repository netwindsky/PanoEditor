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
    initialView: {
      hfov: 100, pitch: 0, yaw: 0,
      fovMin: 50, fovMax: 150, maxPixelZoom: 2.0,
      limitView: 'auto', fovType: 'MFOV',
    },
    location: { lat: 30.5, lng: 120.3, heading: 45 },
    onstart: 'loadscene();',
    sortOrder: 0,
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

  // ===== 对齐参考 733012.xml 格式 =====

  it('根 krpano 标签含 version=1.19 与 title 属性（取自 project.name）', () => {
    const xml = exportToKrpanoXml(
      { id: 'p1', name: '雪漠书院', description: '', coverUrl: '', sceneCount: 0, createdAt: '', updatedAt: '' },
      [],
      null,
    )
    // 根标签出现在第一行
    expect(xml.startsWith('<krpano ')).toBe(true)
    expect(xml).toContain('version="1.19"')
    expect(xml).toContain('title="雪漠书院"')
  })

  it('输出 <include url="skin/vtourskin.xml" /> 默认皮肤引用', () => {
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 0, createdAt: '', updatedAt: '' },
      [],
      null,
    )
    expect(xml).toContain('<include url="skin/vtourskin.xml" />')
  })

  it('startup action 含 autorun="onstart" 与 startscene 兜底逻辑', () => {
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 0, createdAt: '', updatedAt: '' },
      [],
      makeTourSettings({ autoRotate: false, loadsceneBlend: '' }),
    )
    expect(xml).toContain('<action name="startup" autorun="onstart">')
    expect(xml).toContain('if(startscene === null OR !scene[get(startscene)], copy(startscene,scene[0].name); )')
    expect(xml).toContain('loadscene(get(startscene), null, MERGE')
    expect(xml).toContain('if(startactions !== null, startactions() )')
  })

  it('imageConfig 为合法多分辨率 JSON 时输出 CUBE multires tilesize + 多 level + cube url', () => {
    const imageConfig = JSON.stringify({
      type: 'CUBE',
      multires: true,
      tilesize: 512,
      levels: [
        { tiledimagewidth: 7424, tiledimageheight: 7424, cube: { url: 'panos/s1/%s/l4/%0v/l4_%s_%0v_%0h.jpg' } },
        { tiledimagewidth: 1024, tiledimageheight: 1024, cube: { url: 'panos/s1/%s/l1/%0v/l1_%s_%0v_%0h.jpg' } },
      ],
    })
    const scenes = [makeScene({ imageConfig })]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      null,
    )
    expect(xml).toContain('<image type="CUBE" multires="true" tilesize="512">')
    expect(xml).toContain('<level tiledimagewidth="7424" tiledimageheight="7424">')
    expect(xml).toContain('<cube url="panos/s1/%s/l4/%0v/l4_%s_%0v_%0h.jpg" />')
    expect(xml).toContain('<level tiledimagewidth="1024" tiledimageheight="1024">')
    expect(xml).toContain('<cube url="panos/s1/%s/l1/%0v/l1_%s_%0v_%0h.jpg" />')
    expect(xml).toContain('</image>')
  })

  it('imageConfig 为非 JSON / 简单字符串时降级为 <image><cube url="..."/></image>', () => {
    const scenes = [makeScene({ imageConfig: 'panos/s1/pano.jpg' })]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      null,
    )
    expect(xml).toContain('<image>')
    expect(xml).toContain('<cube url="panos/s1/pano.jpg" />')
    expect(xml).toContain('</image>')
    // 不应出现 multires
    expect(xml).not.toContain('multires=')
  })

  it('hotspot 输出 url/width/height/scale/rotate/blendmode/bgcolor 属性（参考 733012.xml 中的自定义 svg 热点）', () => {
    const scenes = [makeScene()]
    const hotspots = [makeHotspot({
      url: 'public/logo.svg',
      width: 80,
      height: 80,
      scale: 1.0,
      rotate: 0,
      blendmode: 'normal',
      bgcolor: '0xFFFFFF',
    })]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      null,
      hotspots,
    )
    expect(xml).toContain('url="public/logo.svg"')
    expect(xml).toContain('width="80"')
    expect(xml).toContain('height="80"')
    expect(xml).toContain('scale="1"')
    expect(xml).toContain('rotate="0"')
    expect(xml).toContain('blendmode="normal"')
    expect(xml).toContain('bgcolor="0xFFFFFF"')
  })

  it('scene onstart 为空时输出 onstart=""（与参考格式一致）', () => {
    const scenes = [makeScene({ onstart: '' })]
    const xml = exportToKrpanoXml(
      { id: 'p1', name: 'proj', description: '', coverUrl: '', sceneCount: 1, createdAt: '', updatedAt: '' },
      scenes,
      null,
    )
    // 场景标签里应保留 onstart=""
    expect(xml).toMatch(/<scene[^>]*onstart=""/)
  })
})
