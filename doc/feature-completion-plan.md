# PanoEditor 功能补齐规划

> 基于 `733012.xml` (krpano 格式, 27 场景) 配置文件分析，对照编辑器当前能力，制定的分阶段 TDD 实施计划。
>
> 创建日期：2026-06-30
> 分析依据：`PanoViewV2/src/assets/733012.xml` + 编辑器源码 + Oracle 范围审查

---

## 一、背景与目标

### 1.1 问题

编辑器当前只覆盖了 krpano XML 配置的一部分能力。XML 中有 27 个场景，每个场景包含 `scene`/`view`/`preview`/`image`/`hotspot` 五层配置，但编辑器的 `SceneProperties` 仅支持 `name` + `initialView(yaw/pitch/hfov)`，大量配置项无法通过编辑器修改。

### 1.2 目标

按优先级补齐编辑器缺失的功能，每一阶段都用 TDD 驱动，确保测试覆盖。

### 1.3 原则

- **TDD 先行**：每一阶段先写失败测试，再实现，最后重构
- **小步前进**：每阶段独立可交付，不跨阶段耦合
- **后端零改动优先**：利用后端已有的 `viewConfig` JSON 字段，避免后端迁移
- **UI 一致性**：新增控件遵循现有 Element Plus 模式（`el-slider` / `el-select` / `el-input-number`）

---

## 二、现状分析

### 2.1 XML 配置结构

```
krpano (global)
├── skin_settings        ← 全局 UI/皮肤配置
├── action (startup)     ← 启动行为
├── layer (commented)    ← 覆盖层
└── scene × 27
    ├── scene attributes (name, title, thumburl, lat, lng, heading, onstart)
    ├── view (hlookat, vlookat, fov, fovmin, fovmax, limitview, maxpixelzoom, fovtype)
    ├── preview
    ├── image (CUBE multires, 4 levels, 512 tilesize)
    └── hotspot × N
        ├── info-icon (linkedscene, tooltip, onclick)
        └── custom-svg (url, width, height, linkedscene, tooltip, onclick)
```

### 2.2 编辑器已实现 vs 缺失

#### Scene 层

| XML 属性 | 编辑器支持 | 说明 |
|---------|-----------|------|
| `name` | ✅ SceneProperties | — |
| `title` | ❌ **缺失** | Scene 接口无 title 字段，但后端已有 |
| `thumburl` | ❌ 不可编辑 | 字段存在但无 UI |
| `lat/lng/heading` | ❌ 完全缺失 | GPS 坐标 |
| `onstart` | ❌ 完全缺失 | 场景启动脚本 |
| `hlookat` (yaw) | ✅ initialView.yaw | — |
| `vlookat` (pitch) | ✅ initialView.pitch | — |
| `fov` (hfov) | ✅ initialView.hfov | — |
| `fovmin` | ❌ **缺失** | 视场角下限 |
| `fovmax` | ❌ **缺失** | 视场角上限 |
| `maxpixelzoom` | ❌ **缺失** | 最大像素缩放 |
| `limitview` | ❌ **缺失** | 视角限制模式 |
| `fovtype` | ❌ **缺失** | 视场角类型 |
| `order` | ❌ 无拖拽 UI | 字段已存在 |

#### Hotspot 层

| XML 属性 | 编辑器支持 | 说明 |
|---------|-----------|------|
| `name/ath/atv` | ✅ | — |
| `style` | ✅ 16 种样式 | — |
| `url/width/height/scale/rotate` | ✅ | — |
| `linkedscene` | ✅ 动作=跳转场景 | — |
| `tooltip/onclick` | ✅ | — |
| `events` | ⚠️ 部分 | UI 有字段但处理不完整 |
| `shader` | ❌ **缺失** | 引擎已支持，编辑器不可配 |
| `custom-svg` 样式 | ⚠️ 间接 | 通过 image + custom-image 样式覆盖 |
| `content` (信息点) | ✅ | — |
| `blendmode/bgcolor/tolerance/feather` | ✅ | — |
| `followzoom` | ✅ | — |

#### 其他模块

| 模块 | 状态 | 说明 |
|------|------|------|
| PostProcessing | ⚠️ 不完整 | 接口有 bloom/LUT/toneMapping，UI 只有基础效果 |
| AudioSettings | ⚠️ 无持久化 | "后端不支持音频设置 API" |
| 全局 Tour Settings | ❌ 完全缺失 | skin_settings 无 UI |
| 场景切换特效 | ❌ 完全缺失 | loadscene_blend 无 UI |
| Layer 覆盖层 | ❌ 完全缺失 | — |
| XML 导出 | ❌ 完全缺失 | 编辑器数据无法导出为 krpano XML |

### 2.3 后端数据模型关键发现（Oracle 审查）

- 后端 `Scene` 实体已有 `view_config` 列（JSON 字符串），`SceneCreateRequest`/`SceneUpdateRequest` 均支持 `viewConfig: String`
- 后端 `Scene` 实体已有 `title` 字段和 `SceneResponse.title`
- 前端 `Scene` 接口**遗漏了 `title` 和 `viewConfig` 字段**
- 前端 `UpdateSceneParams` 只支持 `name/previewUrl/initialView/order`

**结论**：后端已具备存储能力，Phase 1 主要在前端补全类型映射和 UI。

---

## 三、分阶段规划

### Phase 1A：Scene title 字段补全（最高优先级）

**价值**：后端已有，前端遗漏，修复成本最低，立即见效。

**涉及文件**：
- `src/types/index.ts` — Scene 接口新增 `title: string`，UpdateSceneParams 新增 `title?: string`
- `src/components/SceneProperties.vue` — 新增标题输入框
- `src/stores/scene.ts` — updateScene 传递 title
- `src/viewmodels/SceneViewModel.spec.ts` — 新增测试

**TDD 步骤**：
1. RED：写测试验证 SceneProperties 渲染 title 输入框并触发 updateScene
2. GREEN：实现类型 + UI + store 传递
3. 验证：现有测试不回归

**UI 设计**：
```
场景属性
├── 名称: [el-input]
├── 标题: [el-input]        ← 新增
└── 初始视角
    ├── 水平视角 (Yaw)
    ├── 垂直视角 (Pitch)
    └── 视场角 (HFOV)
```

---

### Phase 1B：Scene 视角限制配置（高优先级）

**价值**：fovmin/fovmax/maxpixelzoom 直接影响全景浏览体验，XML 中每个场景都有这些值。

**涉及文件**：
- `src/types/index.ts` — InitialView 新增 `fovMin?/fovMax?/maxPixelZoom?`
- `src/components/SceneProperties.vue` — 新增 3 个滑块
- `src/stores/scene.ts` — 无需改动（initialView 已整体传递）

**TDD 步骤**：
1. RED：写测试验证 SceneProperties 渲染新滑块并触发 updateScene 携带新字段
2. GREEN：实现类型扩展 + UI 滑块
3. 验证：现有测试不回归

**UI 设计**：
```
初始视角
├── 水平视角 (Yaw): [slider] -180~180
├── 垂直视角 (Pitch): [slider] -90~90
├── 视场角 (HFOV): [slider] 30~150
├── 最小视场角: [slider] 10~90      ← 新增
├── 最大视场角: [slider] 90~170     ← 新增
└── 最大像素缩放: [slider] 1.0~4.0  ← 新增
```

**默认值**（来自 XML）：
- fovMin: 70
- fovMax: 140
- maxPixelZoom: 2.0

---

### Phase 1C：Scene 视角模式枚举（中优先级）

**价值**：limitview 和 fovtype 是枚举类型，需要下拉框，UI 模式与滑块不同。

**涉及文件**：
- `src/types/index.ts` — InitialView 新增 `limitView?/fovType?`
- `src/components/SceneProperties.vue` — 新增 2 个下拉框

**TDD 步骤**：
1. RED：写测试验证下拉框渲染和值传递
2. GREEN：实现枚举类型 + UI 下拉框

**UI 设计**：
```
视角限制
├── 限制模式: [el-select] auto | range | off    ← 新增
└── 视场角类型: [el-select] MFOV | VFOV | DFOV  ← 新增
```

**默认值**：
- limitView: 'auto'
- fovType: 'MFOV'

---

### Phase 1D：handleUpdate 防抖（技术债）

**问题**：当前每次滑块拖动触发一次 API 调用，新增字段后会有 8+ 个滑块，拖动时产生大量请求。

**方案**：在 `SceneProperties.vue` 的 `handleUpdate` 中加 300ms 防抖。

**TDD 步骤**：
1. RED：写测试验证连续多次 change 只触发一次 updateScene
2. GREEN：实现防抖

---

### Phase 2：Scene 扩展属性

#### Phase 2A：场景排序拖拽
- SceneList.vue 新增拖拽排序
- 调用 updateScene 传递新 order

#### Phase 2B：缩略图管理
- SceneProperties 新增 thumbUrl 编辑/重新生成

#### Phase 2C：GPS 坐标
- Scene 接口新增 lat/lng/heading
- SceneProperties 新增坐标输入

#### Phase 2D：onstart 脚本
- SceneProperties 新增脚本编辑区

---

### Phase 3：Hotspot 补齐

#### Phase 3A：shader 属性编辑
- HotspotProperties 新增 shader 选择器
- 引擎已支持，仅需 UI + 类型

#### Phase 3B：events 完整处理
- 完善 events JSON 编辑和序列化

#### Phase 3C：custom-svg 样式专门支持
- 新增 SVG 热点子类型或样式增强

---

### Phase 4：PostProcessing 补齐

#### Phase 4A：Bloom 效果
- PostProcessing 接口已有 bloomStrength/bloomThreshold
- UI 新增对应滑块

#### Phase 4B：Tone Mapping
- 新增色调映射选择器

#### Phase 4C：LUT 滤镜
- 对接已有 LutResource API
- 新增 LUT 选择器

---

### Phase 5：Audio 持久化

#### Phase 5A：后端音频 API
- 新增 SceneAudio 实体/DTO/Controller
- 前端 AudioSettings 对接

---

### Phase 6：全局配置

#### Phase 6A：全局漫游设置面板
- skin_settings UI（controlbar/thumbs/tooltips/design）

#### Phase 6B：场景切换特效
- loadscene_blend 配置 UI

#### Phase 6C：XML 导出
- 编辑器数据 → krpano XML 序列化

#### Phase 6D：Layer 覆盖层系统
- 文字栏、按钮等覆盖层编辑

---

## 四、Phase 1 详细实施清单

### 4.1 Phase 1A — Scene title

**类型变更** (`src/types/index.ts`)：
```typescript
export interface Scene {
  id: string
  projectId: string
  name: string
  title: string           // ← 新增
  previewUrl: string
  thumbUrl: string
  imageConfig: string
  status: string
  initialView: InitialView
  order: number
  createdAt: string
  updatedAt: string
}

export interface UpdateSceneParams {
  name?: string
  title?: string          // ← 新增
  previewUrl?: string
  initialView?: Partial<InitialView>
  order?: number
}
```

**UI 变更** (`src/components/SceneProperties.vue`)：
```vue
<div class="prop-row">
  <label>标题</label>
  <el-input v-model="form.title" size="small" @change="handleUpdate" />
</div>
```

**测试** (`src/components/SceneProperties.title.spec.ts`)：
- 渲染时 form.title 从 sceneStore.currentScene.title 初始化
- 修改 title 触发 sceneStore.updateScene 携带 title

### 4.2 Phase 1B — 视角限制

**类型变更** (`src/types/index.ts`)：
```typescript
export interface InitialView {
  hfov: number
  pitch: number
  yaw: number
  fovMin?: number        // ← 新增
  fovMax?: number        // ← 新增
  maxPixelZoom?: number  // ← 新增
}
```

**UI 变更** (`src/components/SceneProperties.vue`)：
```vue
<div class="prop-row">
  <label>最小视场角</label>
  <el-slider v-model="form.fovMin" :min="10" :max="90" :step="1" size="small" @change="handleUpdate" />
  <span class="prop-value">{{ form.fovMin }}°</span>
</div>
<div class="prop-row">
  <label>最大视场角</label>
  <el-slider v-model="form.fovMax" :min="90" :max="170" :step="1" size="small" @change="handleUpdate" />
  <span class="prop-value">{{ form.fovMax }}°</span>
</div>
<div class="prop-row">
  <label>最大像素缩放</label>
  <el-slider v-model="form.maxPixelZoom" :min="1" :max="4" :step="0.1" size="small" @change="handleUpdate" />
  <span class="prop-value">{{ form.maxPixelZoom }}x</span>
</div>
```

**测试** (`src/components/SceneProperties.viewLimits.spec.ts`)：
- 渲染时 form.fovMin/fovMax/maxPixelZoom 从 initialView 初始化
- 修改各值触发 updateScene 携带新 initialView
- 默认值：fovMin=70, fovMax=140, maxPixelZoom=2.0

### 4.3 Phase 1C — 视角模式枚举

**类型变更** (`src/types/index.ts`)：
```typescript
export type LimitViewMode = 'auto' | 'range' | 'off'
export type FovType = 'MFOV' | 'VFOV' | 'DFOV' | 'HFOV'

export interface InitialView {
  hfov: number
  pitch: number
  yaw: number
  fovMin?: number
  fovMax?: number
  maxPixelZoom?: number
  limitView?: LimitViewMode   // ← 新增
  fovType?: FovType           // ← 新增
}
```

**UI 变更**：新增"视角限制"分区，2 个 `el-select`。

**测试** (`src/components/SceneProperties.viewModes.spec.ts`)：
- 下拉框渲染正确选项
- 选择触发 updateScene

### 4.4 Phase 1D — 防抖

**变更** (`src/components/SceneProperties.vue`)：
```typescript
import { debounce } from 'lodash-es' // 或手写

const debouncedUpdate = debounce(handleUpdate, 300)
// 所有 @change 改为 debouncedUpdate
```

**测试**：连续 3 次 change 只触发 1 次 updateScene。

---

## 五、UI 设计要点

### 5.1 布局结构

SceneProperties 扩展后的布局：

```
场景属性
├── 名称: [input]
├── 标题: [input]                    ← 1A
│
├── 初始视角
│   ├── 水平视角 (Yaw): [slider]
│   ├── 垂直视角 (Pitch): [slider]
│   ├── 视场角 (HFOV): [slider]
│   ├── 最小视场角: [slider]         ← 1B
│   ├── 最大视场角: [slider]         ← 1B
│   └── 最大像素缩放: [slider]       ← 1B
│
├── 视角限制                         ← 1C
│   ├── 限制模式: [select]
│   └── 视场角类型: [select]
│
└── 快捷操作
    ├── 音频设置
    ├── 后期处理
    └── 资源库
```

### 5.2 视觉规范

- 遵循现有 CSS 变量：`--text-primary`、`--text-secondary`、`--text-muted`、`--border-color`
- 滑块标签 `min-width: 80px`，值 `min-width: 40px`
- 分区间距 `margin-bottom: 16px`
- 新增分区使用现有 `.prop-section` / `.section-title` 类

### 5.3 可访问性

- 所有 input/select 关联 label（Element Plus el-form-item 自动关联）
- 滑块提供 `aria-label`
- 颜色对比度 ≥ 4.5:1

---

## 六、风险与注意事项

### 6.1 数据模型风险

| 风险 | 说明 | 缓解 |
|------|------|------|
| 前后端字段映射 | 后端 `viewConfig` 是 JSON 字符串，前端 `initialView` 是对象 | 确认 API 层有序列化转换，或前端直接用 viewConfig |
| title 空值 | 旧数据可能无 title | UI 给默认空字符串，不强制必填 |
| 向后兼容 | 新增 optional 字段不影响旧数据 | 所有新字段用 `?` 可选 |

### 6.2 UI 风险

| 风险 | 说明 | 缓解 |
|------|------|------|
| 滑块过多 | Phase 1B 后有 6 个滑块 | Phase 1D 防抖 + 考虑折叠分区 |
| 枚举翻译 | limitView/fovType 需要中文标签 | 定义 label 映射表 |

### 6.3 测试风险

| 风险 | 说明 | 缓解 |
|------|------|------|
| 组件测试依赖 store | SceneProperties 直接用 useSceneStore | mock store 或用现有测试模式 |
| 防抖测试时序 | debounce 需要假定时器 | 使用 vitest fake timers |

---

## 七、实施顺序总览

```
Phase 1A (title)           → 1A.spec.ts → 类型 → UI → 验证
Phase 1B (视角限制数值)     → 1B.spec.ts → 类型 → UI → 验证
Phase 1C (视角模式枚举)     → 1C.spec.ts → 类型 → UI → 验证
Phase 1D (防抖)            → 1D.spec.ts → 实现 → 验证
Phase 2  (场景扩展属性)     → 排序/缩略图/GPS/onstart
Phase 3  (热点补齐)         → shader/events/custom-svg
Phase 4  (后期处理补齐)     → bloom/toneMapping/LUT
Phase 5  (音频持久化)       → 后端API + 前端对接
Phase 6  (全局配置)         → skin_settings/特效/导出/layer
Phase 7  (快捷操作)         → 缩略图自动生成 + 初始视角抓取 ✓
```

每个 Phase 独立交付，完成后再进入下一个。

## 八、Phase 7 — 快捷操作按钮（✓ 2026-07-01 完成）

### 7.1 范围

在 SceneProperties 中添加两个快捷按钮，减少人工操作。

### 7.2 缩略图自动生成

| 项目 | 说明 |
|------|------|
| 功能 | 从全景原图 URL（`scene.previewUrl`）加载图片，中心裁切 16:9 缩放到 1280x720，输出 JPEG dataURL 写入 `thumbUrl` |
| 按钮位置 | 缩略图区（thumbUrl 输入框下方） |
| 条件 | 有场景且有 previewUrl 时可用 |
| 测试 | `SceneProperties.actions.spec.ts` × 4 |

### 7.3 初始视角抓取

| 项目 | 说明 |
|------|------|
| 功能 | 读取引擎当前水平角(yaw)/垂直角(pitch)/视场角(hfov)，写入 `initialView` 字段并保存 |
| 架构 | `PanoEngine.getCameraFov()` → `PanoEngineAdapter.getCurrentView()` → `editorStore.engineAdapter` → `SceneProperties.handleCaptureView()` |
| 按钮位置 | 初始视角区（maxPixelZoom 下方） |
| 条件 | 引擎已就绪（adapter 非 null）时可用 |
| 测试 | `SceneProperties.actions.spec.ts` × 3 |

### 7.4 涉及文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `PanoViewV2/src/panoview/core/PanoEngine.ts` | 修改 | 加 `getCameraFov()` 公开方法 |
| `PanoEditor/src/utils/PanoEngineAdapter.ts` | 修改 | 加 `getCurrentView()` 组合 ath/atv + fov |
| `PanoEditor/src/utils/thumbnailGenerator.ts` | 新增 | canvas 中心 16:9 裁切生成缩略图 |
| `PanoEditor/src/utils/thumbnailGenerator.spec.ts` | 新增 | 9 测试覆盖裁切算法 + 加载流程 |
| `PanoEditor/src/utils/PanoEngineAdapter.spec.ts` | 修改 | 加 2 测试覆盖 getCurrentView |
| `PanoEditor/src/stores/editor.ts` | 修改 | 加 `engineAdapter` shallowRef + setter |
| `PanoEditor/src/components/EditorCanvas.vue` | 修改 | `onEngineReady` 注入 store |
| `PanoEditor/src/components/SceneProperties.vue` | 修改 | 加按钮 + handlers |
| `PanoEditor/src/components/SceneProperties.actions.spec.ts` | 新增 | 7 测试覆盖按钮渲染/点击/禁用 |

### 7.5 回归基线

```
Tests: 256 passed, 15 pre-existing failed, 271 total
LSP:  zero errors across all changed files
```
