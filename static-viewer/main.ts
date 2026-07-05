/**
 * Static Viewer 入口
 *
 * 启动 PanoViewV2 的 PanoEngine，从同级 config.json 加载所有场景，
 * 覆盖顶部场景标题、底部缩略图导航与右上角自动旋转按钮。
 * 路径相对于 index.html 所在目录（zip 根），资源 URL 已由导出器重写为
 * assets/ 相对路径，故 baseUrl 设为 ''。
 */
import { PanoEngine } from '@panoview'
import type { SceneData } from '@panoview'
import { Euler, MathUtils } from 'three'

interface StaticConfig {
  title: string
  initialSceneId?: string
  scenes: SceneData[]
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector(sel) as T | null

async function main() {
  const container = $('#pano') as HTMLElement
  const loading = $('#loading') as HTMLElement
  const loadingText = $('#loading-text') as HTMLElement
  const errorBox = $('#error') as HTMLElement
  const titleEl = $('#scene-title') as HTMLElement
  const thumbBar = $('#thumb-bar') as HTMLElement
  const autoRotateBtn = $('#auto-rotate-btn') as HTMLButtonElement

  const showError = (msg: string) => {
    errorBox.textContent = msg
    errorBox.style.display = 'block'
    loading?.classList.add('hidden')
  }

  try {
    loadingText.textContent = '正在加载配置...'
    // base 相对路径：zip 解压后 index.html 与 config.json 同级
    const res = await fetch('./config.json', { cache: 'no-cache' })
    if (!res.ok) throw new Error(`config.json 加载失败 (${res.status})`)
    const cfg: StaticConfig = await res.json()

    if (!cfg.scenes || cfg.scenes.length === 0) {
      throw new Error('配置中没有场景数据')
    }

    document.title = cfg.title || document.title

    // 构造引擎（autoLoad:false 跳过内置 XML demo；不显示 stats 面板）
    const engine = new PanoEngine(container, { autoLoad: false } as any)
    // 隐藏 stats
    const statsEl = container.querySelector('.stats') as HTMLElement | null
    if (statsEl) statsEl.style.display = 'none'

    // 静态包资源相对路径，baseUrl 必须为空字符串才能让瓦片 URL（assets/...）原样走
    engine.setBaseUrl('./')

    // 缩略图索引
    const sceneOrder = cfg.scenes.map((s) => s.scene.name)
    const sceneById = new Map<string, SceneData>()
    cfg.scenes.forEach((s) => sceneById.set(s.scene.name, s))

    const buildThumbs = () => {
      thumbBar.innerHTML = ''
      cfg.scenes.forEach((s) => {
        const div = document.createElement('div')
        div.className = 'thumb'
        const thumbUrl = s.scene.thumburl || s.preview?.url || ''
        if (thumbUrl) {
          div.style.backgroundImage = `url('./${thumbUrl.replace(/^\.?\//, '')}')`
        }
        const label = document.createElement('span')
        label.textContent = s.scene.title || s.scene.name
        div.appendChild(label)
        div.addEventListener('click', () => {
          if (engine.getCurrentSceneId() !== s.scene.name) {
            void engine.changeScene(s.scene.name)
          }
        })
        thumbBar.appendChild(div)
      })
    }

    const markActiveThumb = (sceneId: string) => {
      const thumbs = thumbBar.querySelectorAll('.thumb')
      thumbs.forEach((t, i) => {
        if (sceneOrder[i] === sceneId) t.classList.add('active')
        else t.classList.remove('active')
      })
      const sc = sceneById.get(sceneId)
      if (titleEl && sc) titleEl.textContent = sc.scene.title || sc.scene.name
    }

    buildThumbs()

    // 监听场景切换
    container.addEventListener('scenechanged', ((e: CustomEvent<{ sceneId: string }>) => {
      markActiveThumb(e.detail.sceneId)
    }) as EventListener)

    // 初始场景
    const initialId = cfg.initialSceneId && sceneById.has(cfg.initialSceneId)
      ? cfg.initialSceneId
      : cfg.scenes[0].scene.name

    loadingText.textContent = '正在加载全景...'
    await engine.loadScenes(cfg.scenes)
    // loadScenes 默认加载 scenes[0]，需要切到 initialId
    if (initialId !== cfg.scenes[0].scene.name) {
      await engine.changeScene(initialId)
    } else {
      markActiveThumb(initialId)
    }

    // 自动旋转（复用 PanoViewer 逻辑：RAF 绕 yaw 自转，仅在全景模式下生效）
    let autoRotateRaf: number | null = null
    let autoRotateSpeed = 12
    let autoRotateLast = 0
    const stopAutoRotate = () => {
      if (autoRotateRaf !== null) {
        cancelAnimationFrame(autoRotateRaf)
        autoRotateRaf = null
      }
      autoRotateBtn.classList.remove('active')
    }
    const startAutoRotate = () => {
      if (autoRotateRaf !== null) return
      autoRotateBtn.classList.add('active')
      autoRotateLast = performance.now()
      const cam = (engine as any).camera
      const euler = new Euler(0, 0, 0, 'YXZ')
      const tick = () => {
        const now = performance.now()
        const dt = (now - autoRotateLast) / 1000
        autoRotateLast = now
        if (!(engine as any).isFlyMode && cam) {
          euler.setFromQuaternion(cam.quaternion)
          euler.y += MathUtils.degToRad(autoRotateSpeed * dt)
          euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x))
          cam.quaternion.setFromEuler(euler)
        }
        autoRotateRaf = requestAnimationFrame(tick)
      }
      autoRotateRaf = requestAnimationFrame(tick)
    }
    autoRotateBtn.addEventListener('click', () => {
      if (autoRotateRaf !== null) stopAutoRotate()
      else startAutoRotate()
    })

    // 用户交互时停止自动旋转
    const onInteract = () => { if (autoRotateRaf !== null) stopAutoRotate() }
    container.addEventListener('pointerdown', onInteract)
    container.addEventListener('wheel', onInteract, { passive: true })

    // 加载完成，淡出遮罩
    setTimeout(() => loading?.classList.add('hidden'), 300)
  } catch (err: any) {
    console.error(err)
    showError(`加载失败: ${err?.message || String(err)}`)
  }
}

void main()
