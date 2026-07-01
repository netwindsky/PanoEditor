/**
 * PanoEngine 视角往返一致性测试
 *
 * 验证 initCameraView → getCenterCoords → getCurrentView 的往返不丢失符号信息。
 *
 * 修复前：initCameraView 使用 euler.y -= (hlookat-180)，导致 yaw 每轮往返翻转符号。
 * 修复后：initCameraView 直接设 euler.y = -hlookat，getCenterCoords 以 -Z 为参考轴。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Euler, Vector3, PerspectiveCamera } from 'three'

/**
 * 修复后的 initCameraView：直接设置绝对角度
 */
function simulateInitCameraView(
  camera: PerspectiveCamera,
  viewData: { hlookat: string; vlookat: string },
): void {
  const hlookat = Number(viewData.hlookat) || 0
  const vlookat = Number(viewData.vlookat) || 0
  camera.quaternion.setFromEuler(
    new Euler(-vlookat * Math.PI / 180, -hlookat * Math.PI / 180, 0, 'YXZ'),
  )
  camera.updateMatrixWorld(true)
}

/**
 * 修复后的 getCenterCoords：以 -Z 为参考
 */
function simulateGetCenterCoords(camera: PerspectiveCamera): { ath: number; atv: number } {
  const direction = new Vector3()
  camera.getWorldDirection(direction)
  const ath = Math.atan2(-direction.x, -direction.z) * (180 / Math.PI)
  const atv = Math.asin(direction.y) * (180 / Math.PI)
  return { ath, atv }
}

/**
 * getCurrentView（不变）：yaw = -ath, pitch = -atv
 */
function simulateGetCurrentView(camera: PerspectiveCamera): { yaw: number; pitch: number } {
  const { ath, atv } = simulateGetCenterCoords(camera)
  return { yaw: -ath, pitch: -atv }
}

/**
 * 模拟 PanoEngine.changeScene 中的相机重置
 */
function simulateResetCamera(camera: PerspectiveCamera): void {
  camera.position.set(0, 0, 0)
  camera.rotation.set(0, 0, 0)
  camera.updateMatrixWorld(true)
}

describe('Camera view roundtrip (initCameraView ↔ getCurrentView)', () => {
  let camera: PerspectiveCamera

  beforeEach(() => {
    camera = new PerspectiveCamera(90, 16 / 9, 0.1, 1000)
    camera.position.set(0, 0, 0)
    camera.rotation.set(0, 0, 0)
    camera.updateMatrixWorld(true)
  })

  // ===== 基础往返 =====
  it('hlookat=0, vlookat=0 → yaw=0, pitch=0', () => {
    simulateInitCameraView(camera, { hlookat: '0', vlookat: '0' })
    const { yaw, pitch } = simulateGetCurrentView(camera)
    expect(yaw).toBeCloseTo(0)
    expect(pitch).toBeCloseTo(0)
  })

  it('hlookat=45, vlookat=20 → yaw=45, pitch=20', () => {
    simulateInitCameraView(camera, { hlookat: '45', vlookat: '20' })
    const { yaw, pitch } = simulateGetCurrentView(camera)
    expect(yaw).toBeCloseTo(45, 0)
    expect(pitch).toBeCloseTo(20, 0)
  })

  it('hlookat=-45, vlookat=-20 → yaw=-45, pitch=-20', () => {
    simulateInitCameraView(camera, { hlookat: '-45', vlookat: '-20' })
    const { yaw, pitch } = simulateGetCurrentView(camera)
    expect(yaw).toBeCloseTo(-45, 0)
    expect(pitch).toBeCloseTo(-20, 0)
  })

  // ===== 完整往返循环 =====
  it('模拟完整往返：记录→保存→恢复→读取，不应翻转符号', () => {
    simulateInitCameraView(camera, { hlookat: '45', vlookat: '20' })
    const view1 = simulateGetCurrentView(camera)

    simulateResetCamera(camera)
    simulateInitCameraView(camera, { hlookat: String(Math.round(view1.yaw)), vlookat: String(Math.round(view1.pitch)) })
    const view2 = simulateGetCurrentView(camera)

    expect(view2.yaw).toBeCloseTo(view1.yaw, 0)
    expect(view2.pitch).toBeCloseTo(view1.pitch, 0)
  })

  // ===== 极值角度 =====
  it('hlookat=90, vlookat=45 → yaw=90, pitch=45', () => {
    simulateInitCameraView(camera, { hlookat: '90', vlookat: '45' })
    const { yaw, pitch } = simulateGetCurrentView(camera)
    expect(yaw).toBeCloseTo(90, 0)
    expect(pitch).toBeCloseTo(45, 0)
  })

  it('hlookat=-90, vlookat=30 → yaw=-90, pitch=30', () => {
    simulateInitCameraView(camera, { hlookat: '-90', vlookat: '30' })
    const { yaw, pitch } = simulateGetCurrentView(camera)
    expect(yaw).toBeCloseTo(-90, 0)
    expect(pitch).toBeCloseTo(30, 0)
  })

  // ===== 多轮往返 =====
  it('三轮往返后符号保持不变', () => {
    let yaw = 60, pitch = -15

    for (let i = 0; i < 3; i++) {
      simulateResetCamera(camera)
      simulateInitCameraView(camera, { hlookat: String(yaw), vlookat: String(pitch) })
      const view = simulateGetCurrentView(camera)
      yaw = Math.round(view.yaw)
      pitch = Math.round(view.pitch)
    }

    expect(yaw).toBeCloseTo(60, 0)
    expect(pitch).toBeCloseTo(-15, 0)
  })

  // ===== 方向验证 =====
  it('hlookat=45 时相机应面向 +X（右转）', () => {
    simulateInitCameraView(camera, { hlookat: '45', vlookat: '0' })
    const dir = new Vector3()
    camera.getWorldDirection(dir)
    expect(dir.x).toBeGreaterThan(0)
    expect(dir.z).toBeLessThan(0)
  })

  it('hlookat=-45 时相机应面向 -X（左转）', () => {
    simulateInitCameraView(camera, { hlookat: '-45', vlookat: '0' })
    const dir = new Vector3()
    camera.getWorldDirection(dir)
    expect(dir.x).toBeLessThan(0)
    expect(dir.z).toBeLessThan(0)
  })
})
