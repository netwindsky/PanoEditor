import type { HotspotType } from '@/types'

/**
 * 属性面板中的可配置字段标识。
 * 不同热点类型显示不同字段子集——这是“四种类型属性差异化”的契约来源。
 */
export type HotspotField =
  | 'name' // 名称（所有类型）
  | 'coords' // ATH/ATV 球坐标（所有类型）
  | 'action' // 点击动作（所有类型，选择框）
  | 'style' // 图标样式（info / scene）
  | 'infoContent' // 标题/描述/图片（info）
  | 'url' // 资源（image=图片 / quad=贴图 / model=模型文件）
  | 'width' // 宽（image / quad）
  | 'height' // 高（image / quad）
  | 'scale' // 缩放（image / model）
  | 'rotate' // 旋转（image / model）
  | 'blendmode' // 混合模式（image / quad）
  | 'points' // 4 顶点坐标（quad）
  | 'bgcolor' // 背景色（当前无类型使用；保留枚举以便未来扩展）

/** 所有类型共有的基础字段 */
const COMMON: HotspotField[] = ['name', 'coords', 'action']

/**
 * 各热点类型的差异化字段（不含 COMMON，运行时会合并）。
 * 依据：
 *  - 引擎各 create* 方法实际消费的字段
 *  - 用户确认的差异化方案（quad 去掉 bgcolor）
 */
const FIELDS_BY_TYPE: Partial<Record<HotspotType, HotspotField[]>> = {
  info: ['style', 'infoContent'],
  scene: ['style'],
  image: ['url', 'width', 'height', 'scale', 'rotate', 'blendmode'],
  quad: ['url', 'points', 'width', 'height', 'blendmode'],
  model: ['url', 'scale', 'rotate'],
}

/**
 * 返回指定热点类型应显示的字段列表（含基础字段）。
 * 未知类型回退为仅基础字段，保证 UI 不崩。
 */
export function getVisibleFields(type: HotspotType): HotspotField[] {
  const specific = FIELDS_BY_TYPE[type] ?? []
  return [...COMMON, ...specific]
}
