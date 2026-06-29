/**
 * 点击动作模型：用结构化的选择框替代让用户手写 JSON 的 Event(On) 文本框。
 *
 * 引擎语义（HotspotManager.parseHotspotEvents / bindDomEvents）：
 *  - linkedSceneId 非空 → 点击跳转该场景
 *  - onclick / events  → 自定义脚本 handler
 */
export type HotspotActionKind = 'none' | 'scene' | 'script'

export interface HotspotAction {
  kind: HotspotActionKind
  /** kind==='scene' 时的目标场景 id */
  sceneId?: string
  /** kind==='script' 时的脚本文本（兼容旧的 onclick / events 原文） */
  script?: string
}

/** 热点中与点击动作相关的原始字段子集 */
export interface ActionFields {
  linkedSceneId?: string
  onclick?: string
  events?: string
}

/**
 * 从热点原始字段解析出点击动作。
 * 优先级：linkedSceneId > onclick > events（场景跳转语义最明确）。
 * 旧数据（events JSON）也能被识别为 script，原文保留不丢。
 */
export function parseAction(fields: ActionFields): HotspotAction {
  if (fields.linkedSceneId) {
    return { kind: 'scene', sceneId: fields.linkedSceneId }
  }
  if (fields.onclick) {
    return { kind: 'script', script: fields.onclick }
  }
  if (fields.events) {
    return { kind: 'script', script: fields.events }
  }
  return { kind: 'none' }
}

/**
 * 把点击动作序列化回原始字段。
 * 关键：切换动作类型时清空其它类型的字段（用 undefined），避免残留脏数据。
 * scene 但 sceneId 为空时视为 none。
 */
export function serializeAction(action: HotspotAction): ActionFields {
  if (action.kind === 'scene' && action.sceneId) {
    return { linkedSceneId: action.sceneId, onclick: undefined, events: undefined }
  }
  if (action.kind === 'script' && action.script) {
    return { onclick: action.script, linkedSceneId: undefined, events: undefined }
  }
  // none，或缺少必要值的 scene/script
  return { linkedSceneId: undefined, onclick: undefined, events: undefined }
}
