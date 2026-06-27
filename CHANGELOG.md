# 更新日志

## [2026-06-25] - 引擎适配层重构与功能增强

### 新增
- **场景状态管理增强**
  - 添加 `currentTilingStatus` 计算属性，归一化切片状态（READY/PROCESSING/FAILED）
  - 添加 `currentTilingProgress` 计算属性，实时追踪切片进度（0-100）
  - 切片完成后自动刷新场景数据，获取完整的 imageConfig

- **Vite 配置优化**
  - 添加 `dedupe: ['three']` 确保 Three.js 单实例
  - 使用数组形式的 alias 配置，精确匹配 `three` 入口避免子路径解析问题

### 改进
- **PanoEngineAdapter 重构**
  - 大幅简化代码（-327 行），移除冗余的场景初始化和清理逻辑
  - 改为委托模式，直接调用 PanoEngine 的公共 API
  - 优化热点管理方法，统一使用引擎内部接口
  - 改进坐标转换和射线检测逻辑

- **EditorCanvas 组件**
  - 优化场景加载流程，支持后端数据注入
  - 改进引擎初始化和销毁逻辑

- **HotspotProperties 组件**
  - 增强热点属性编辑功能
  - 优化 UI 交互体验

- **SceneService 服务**
  - 添加 `fetchScene` 方法，支持获取单个场景详情
  - 优化场景数据获取逻辑

### 修复
- 修复 Three.js 多实例警告问题
- 修复切片完成后场景数据不更新的问题
- 修复热点高亮和取消高亮的样式问题

### 技术细节
- 修改文件：7 个
- 代码变更：+225 行，-327 行
- 主要重构：PanoEngineAdapter.ts（从 400+ 行精简到 200 行左右）
