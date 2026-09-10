# Notepad
<!-- Auto-managed by OMC. Manual edits preserved in MANUAL section. -->

## Priority Context
<!-- ALWAYS loaded. Keep under 500 chars. Critical discoveries only. -->
## Done
- getCurrentView 角度翻转修复（negate ath/atv），已推送到 PanoEditor main
- 缩略图截屏改造：PanoEngine.captureView() + thumbnailGenerator.resizeImageDataUrl() + adapter.captureThumbnail(640,360) + SceneProperties 接入，全部测试通过，已推送

## Key
- 惯例转换在 getCurrentView() 出口做，不改 initCameraView

## Goal
- 修复场景切换时 initialView 视角 pitch/yaw 符号翻转的 bug
- 将缩略图生成从"加载预览 URL 裁切"改为"从当前全景视口截取 640×360"

## Done
1. **视角翻转修复**（已推送到 GitHub）：
   - 定位根因：`getCenterCoords()` 数学惯例（ath>0=左转, atv>0=仰视）与 `initCameraView` krpano 惯例（hlookat>0=右转, vlookat>0=俯视）冲突
   - 修复 `PanoEngineAdapter.getCurrentView()`：返回前 negate ath/atv
   - 更新测试，全部通过
   - Commit: `f74cbcf` → PanoEditor main

2. **缩略图截屏改造**（已推送到 GitHub）：
   - `PanoViewV2 PanoEngine.ts`: 添加 `captureView(quality=0.85)` 公共方法（WebGL canvas → dataURL）
   - `thumbnailGenerator.ts`: 添加 `resizeImageDataUrl(dataUrl, width, height, quality)` 异步缩放函数
   - `PanoEngineAdapter.ts`: 添加 `captureThumbnail(width=640, height=360)` 方法
   - `SceneProperties.vue`: `handleGenerateThumbnail` 改为调用 `adapter.captureThumbnail(640, 360)`
   - 测试全部通过（13/13）
   - Commits: `cdfb4b5` (PanoViewV2), `65f19c2` + `3215147` (PanoEditor)

## Key Decisions
- 修复选在 `getCurrentView()` 做惯例转换（negate ath/atv）而非改 `initCameraView`
- 截屏方案：在 PanoEngine 暴露 `captureView()` 访问私有 renderer 的 canvas（比通过 DOM 找 canvas 更健壮）
- `resizeImageDataUrl` 使用 canvas 2D drawImage 缩放（不引入额外依赖）

## Working Memory
<!-- Session notes. Auto-pruned after 7 days. -->
### 2026-06-30 15:10
### 2026-06-30 15:10
Phase 1 (SceneProperties 场景配置) 全部完成 TDD：
- 1A title: 3 tests ✓
- 1B fovMin/fovMax/maxPixelZoom: 5 tests ✓
- 1C limitView/fovType 枚举: 6 tests ✓
- 1D handleUpdate 300ms 防抖: 2 tests ✓
共 16 新测试全通过。基线 161 passed / 15 failed (pre-existing) / 零回归。
防抖实现：doUpdate() + setTimeout/clearTimeout 300ms + onBeforeUnmount 清理。
已修复 1A/1B/1C 测试适配防抖（vi.useFakeTimers + advanceTimersByTime(300)）。
下一步: Phase 2 (场景排序/缩略图/GPS) 或其他。
### 2026-06-30 16:00
Phase 3 完整完成 (3A shader前后端 + 3B events JSON + 3C custom-svg)。测试基线: 15 failed(pre-existing) / 183 passed / 198 total / 零回归 / LSP零错误。

Phase 4 启动 — PostProcessing补齐:
- 计划: 4A Bloom滑块(bloomStrength/bloomThreshold接口已有) / 4B ToneMapping选择器 / 4C LUT选择器(对接已有LutResource API)
- 关键: 接口已有字段, UI不完整
- 已派 explore agent (bg_88fc51c0 / ses_0e6bdbc0effe4hOyluMTnsNWPz) 探索现有PostProcessing组件状态
- 等待探索结果后写RED测试

SQL迁移 V20260630__hotspot_add_shader.sql 已创建 (存储过程幂等ADD COLUMN shader VARCHAR(100))。
### 2026-06-30 16:17
PanoEditor 功能补齐 Phase 1~6C 全部完成 (TDD)。测试基线: 15 failed(pre-existing) / 224 passed / 239 total / 零回归 / LSP零错误。

新增 89 个测试覆盖:
- Phase 1 (26): title/fovMin/fovMax/maxPixelZoom/limitView/fovType/handleUpdate防抖
- Phase 2 (13): 场景拖拽排序/缩略图管理/GPS坐标/onstart脚本
- Phase 3A (4): Hotspot shader选择器(前端+后端5Java文件+SQL迁移)
- Phase 3B (5): events JSON编辑器+验证
- Phase 3C: custom-svg样式选项
- Phase 4 (12): PostProcessingPanel重写匹配API契约(exposure/contrast/saturation/colorTemperature/bloomStrength/bloomThreshold/toneMapping/enabled)
- Phase 5 (9): AudioSettings API持久化集成+后端SceneAudio全栈(entity/DTO/service/controller/migration)
- Phase 6A+6B (9): TourSettings全局配置面板(skin_settings/loadsceneBlend/autoRotate/FOV)
- Phase 6C (11): exportToKrpanoXml XML导出工具

剩余: Phase 6D (Layer覆盖层系统) — 低优先级，待后续迭代。
### 2026-06-30 16:22
全部 Phase 1~6 完成！最终测试基线: 15 failed(pre-existing) / 238 passed / 253 total / 零回归 / LSP零错误。

Phase 6D Layer覆盖层系统完成:
- 新增类型: OverlayLayer/LayerType/LayerAlign (types/index.ts)
- 新增组件: LayerOverlayPanel.vue (CRUD layers, 存入 Project.settings JSON)
- xmlExport.ts 扩展: 导出 <layer> 标签 (text/button/container 类型)
- 新增测试: LayerOverlayPanel.spec.ts (9测试) + xmlExport.layers.spec.ts (5测试)
- RightPanelSection 加 'overlay' 选项

全项目最终统计:
- 103 个新测试 (Phase 1~6)
- 13 个后端 Java 文件 (shader 5 + audio 8)
- 2 个 SQL 迁移脚本 (V20260630 + V20260701)
- 3 个新前端组件 (TourSettings/LayerOverlayPanel + 重写 PostProcessingPanel/AudioSettings)
- 2 个新前端 API 模块 (audio.ts)
- 1 个 XML 导出工具 (xmlExport.ts)
- 类型系统全面更新 (Scene/Hotspot/TourSettings/OverlayLayer/AudioSettings)


## 2026-06-30 15:10
### 2026-06-30 15:10
Phase 1 (SceneProperties 场景配置) 全部完成 TDD：
- 1A title: 3 tests ✓
- 1B fovMin/fovMax/maxPixelZoom: 5 tests ✓
- 1C limitView/fovType 枚举: 6 tests ✓
- 1D handleUpdate 300ms 防抖: 2 tests ✓
共 16 新测试全通过。基线 161 passed / 15 failed (pre-existing) / 零回归。
防抖实现：doUpdate() + setTimeout/clearTimeout 300ms + onBeforeUnmount 清理。
已修复 1A/1B/1C 测试适配防抖（vi.useFakeTimers + advanceTimersByTime(300)）。
下一步: Phase 2 (场景排序/缩略图/GPS) 或其他。
### 2026-06-30 16:00
Phase 3 完整完成 (3A shader前后端 + 3B events JSON + 3C custom-svg)。测试基线: 15 failed(pre-existing) / 183 passed / 198 total / 零回归 / LSP零错误。

Phase 4 启动 — PostProcessing补齐:
- 计划: 4A Bloom滑块(bloomStrength/bloomThreshold接口已有) / 4B ToneMapping选择器 / 4C LUT选择器(对接已有LutResource API)
- 关键: 接口已有字段, UI不完整
- 已派 explore agent (bg_88fc51c0 / ses_0e6bdbc0effe4hOyluMTnsNWPz) 探索现有PostProcessing组件状态
- 等待探索结果后写RED测试

SQL迁移 V20260630__hotspot_add_shader.sql 已创建 (存储过程幂等ADD COLUMN shader VARCHAR(100))。
### 2026-06-30 16:17
PanoEditor 功能补齐 Phase 1~6C 全部完成 (TDD)。测试基线: 15 failed(pre-existing) / 224 passed / 239 total / 零回归 / LSP零错误。

新增 89 个测试覆盖:
- Phase 1 (26): title/fovMin/fovMax/maxPixelZoom/limitView/fovType/handleUpdate防抖
- Phase 2 (13): 场景拖拽排序/缩略图管理/GPS坐标/onstart脚本
- Phase 3A (4): Hotspot shader选择器(前端+后端5Java文件+SQL迁移)
- Phase 3B (5): events JSON编辑器+验证
- Phase 3C: custom-svg样式选项
- Phase 4 (12): PostProcessingPanel重写匹配API契约(exposure/contrast/saturation/colorTemperature/bloomStrength/bloomThreshold/toneMapping/enabled)
- Phase 5 (9): AudioSettings API持久化集成+后端SceneAudio全栈(entity/DTO/service/controller/migration)
- Phase 6A+6B (9): TourSettings全局配置面板(skin_settings/loadsceneBlend/autoRotate/FOV)
- Phase 6C (11): exportToKrpanoXml XML导出工具

剩余: Phase 6D (Layer覆盖层系统) — 低优先级，待后续迭代。


## 2026-06-30 15:10
### 2026-06-30 15:10
Phase 1 (SceneProperties 场景配置) 全部完成 TDD：
- 1A title: 3 tests ✓
- 1B fovMin/fovMax/maxPixelZoom: 5 tests ✓
- 1C limitView/fovType 枚举: 6 tests ✓
- 1D handleUpdate 300ms 防抖: 2 tests ✓
共 16 新测试全通过。基线 161 passed / 15 failed (pre-existing) / 零回归。
防抖实现：doUpdate() + setTimeout/clearTimeout 300ms + onBeforeUnmount 清理。
已修复 1A/1B/1C 测试适配防抖（vi.useFakeTimers + advanceTimersByTime(300)）。
下一步: Phase 2 (场景排序/缩略图/GPS) 或其他。
### 2026-06-30 16:00
Phase 3 完整完成 (3A shader前后端 + 3B events JSON + 3C custom-svg)。测试基线: 15 failed(pre-existing) / 183 passed / 198 total / 零回归 / LSP零错误。

Phase 4 启动 — PostProcessing补齐:
- 计划: 4A Bloom滑块(bloomStrength/bloomThreshold接口已有) / 4B ToneMapping选择器 / 4C LUT选择器(对接已有LutResource API)
- 关键: 接口已有字段, UI不完整
- 已派 explore agent (bg_88fc51c0 / ses_0e6bdbc0effe4hOyluMTnsNWPz) 探索现有PostProcessing组件状态
- 等待探索结果后写RED测试

SQL迁移 V20260630__hotspot_add_shader.sql 已创建 (存储过程幂等ADD COLUMN shader VARCHAR(100))。


## 2026-06-30 15:10
### 2026-06-30 15:10
Phase 1 (SceneProperties 场景配置) 全部完成 TDD：
- 1A title: 3 tests ✓
- 1B fovMin/fovMax/maxPixelZoom: 5 tests ✓
- 1C limitView/fovType 枚举: 6 tests ✓
- 1D handleUpdate 300ms 防抖: 2 tests ✓
共 16 新测试全通过。基线 161 passed / 15 failed (pre-existing) / 零回归。
防抖实现：doUpdate() + setTimeout/clearTimeout 300ms + onBeforeUnmount 清理。
已修复 1A/1B/1C 测试适配防抖（vi.useFakeTimers + advanceTimersByTime(300)）。
下一步: Phase 2 (场景排序/缩略图/GPS) 或其他。


## 2026-06-30 15:10
## Phase 1 全部完成 (1A+1B+1C+1D)

### 最终状态
- **测试基线**: 161 passed / 15 failed (pre-existing) / 176 total
- **新增测试**: 16 个（1A:3 + 1B:5 + 1C:6 + 1D:2）
- **零回归**: pre-existing 15 failed 不变
- **LSP**: 零错误

### Phase 1D 实现细节
- `SceneProperties.vue` 中 `handleUpdate` 改为 300ms 防抖
- 核心逻辑提取为 `doUpdate()`，防抖包装为 `handleUpdate()`
- `onBeforeUnmount` 清理定时器防止内存泄漏
- 修复 3 个测试文件（title/viewLimits/viewModes）适配防抖：加 `vi.useFakeTimers()` + `vi.advanceTimersByTime(300)`

### 下一步：Phase 2（场景排序/缩略图/GPS/onstart）
- 需要读取 `doc/feature-completion-plan.md` 中 Phase 2 规划
- 继续 TDD 流程


## MANUAL
<!-- User content. Never auto-pruned. -->

