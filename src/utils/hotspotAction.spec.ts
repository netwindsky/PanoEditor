import { describe, it, expect } from 'vitest'
import { parseAction, serializeAction, type HotspotAction } from './hotspotAction'

/**
 * 点击动作：用选择框替代原先让用户手写 JSON 的 Event(On) 文本框。
 * 引擎语义（见 HotspotManager.parseHotspotEvents / bindDomEvents）：
 *  - linkedSceneId 非空 → 点击跳转该场景
 *  - onclick / events 是自定义脚本 handler
 * 三种动作：
 *  - none   : 无任何点击行为
 *  - scene  : 跳转场景（承载于 linkedSceneId）
 *  - script : 自定义脚本（承载于 onclick，兼容旧的 events）
 *
 * 设计原则：解析要能识别旧数据；序列化时切换动作类型不能残留其它类型的字段。
 */
describe('parseAction', () => {
  it('linkedSceneId 非空 → scene 动作，带 sceneId', () => {
    const a = parseAction({ linkedSceneId: 'scene-123' })
    expect(a.kind).toBe('scene')
    expect(a.sceneId).toBe('scene-123')
  })

  it('onclick 非空 → script 动作，带 script 文本', () => {
    const a = parseAction({ onclick: 'doSomething()' })
    expect(a.kind).toBe('script')
    expect(a.script).toBe('doSomething()')
  })

  it('旧数据 events(JSON) 也识别为 script，保留原文不丢', () => {
    const a = parseAction({ events: '{"click":"func()"}' })
    expect(a.kind).toBe('script')
    expect(a.script).toBe('{"click":"func()"}')
  })

  it('都为空 → none 动作', () => {
    expect(parseAction({}).kind).toBe('none')
    expect(parseAction({ linkedSceneId: '', onclick: '', events: '' }).kind).toBe('none')
  })

  it('linkedSceneId 优先于 onclick（场景跳转语义更明确）', () => {
    const a = parseAction({ linkedSceneId: 's1', onclick: 'x()' })
    expect(a.kind).toBe('scene')
    expect(a.sceneId).toBe('s1')
  })
})

describe('serializeAction', () => {
  it('scene 动作 → 写 linkedSceneId，清空 onclick/events', () => {
    const out = serializeAction({ kind: 'scene', sceneId: 'scene-9' })
    expect(out.linkedSceneId).toBe('scene-9')
    expect(out.onclick).toBeUndefined()
    expect(out.events).toBeUndefined()
  })

  it('script 动作 → 写 onclick，清空 linkedSceneId/events', () => {
    const out = serializeAction({ kind: 'script', script: 'foo()' })
    expect(out.onclick).toBe('foo()')
    expect(out.linkedSceneId).toBeUndefined()
    expect(out.events).toBeUndefined()
  })

  it('none 动作 → 三个字段都清空（undefined）', () => {
    const out = serializeAction({ kind: 'none' })
    expect(out.linkedSceneId).toBeUndefined()
    expect(out.onclick).toBeUndefined()
    expect(out.events).toBeUndefined()
  })

  it('scene 但 sceneId 为空 → 视为 none，不写脏数据', () => {
    const out = serializeAction({ kind: 'scene', sceneId: '' })
    expect(out.linkedSceneId).toBeUndefined()
  })

  it('round-trip：parse(serialize(x)) 还原动作类型', () => {
    const cases: HotspotAction[] = [
      { kind: 'scene', sceneId: 's1' },
      { kind: 'script', script: 'bar()' },
      { kind: 'none' },
    ]
    for (const a of cases) {
      const restored = parseAction(serializeAction(a))
      expect(restored.kind).toBe(a.kind)
    }
  })
})
