feat: 静态化导出系统增强、Web 热点支持及版本管理优化

## 核心功能

### 1. 静态化导出系统优化
**staticPacker.ts**
- 重构 Viewer 资源路径解析逻辑，支持基于 Vite base 配置的动态路径适配
- 新增 `resolveViewerBase()` 函数，兼容编辑器部署到子路径场景（如 `/editor/`）
- 支持相对路径 base 模式（`./`），提升部署灵活性
- 新增 version.json 写入功能，打包时注入 PanoViewV2 commit hash 便于版本排查
- 通过 `__BUILD_VERSION__` 常量注入构建版本信息

**static-viewer/main.ts**
- 优化 Viewer 初始化逻辑，适配新的路径解析机制

### 2. Web 热点类型支持
**hotspotFactory.ts**
- 新增 `web` 类型热点支持，复用 quad 的 4 顶点几何结构
- 使用 `style: 'custom-web'` 创建 DOM WebHotspot（通过 CSS matrix3d 实现 4 点透视贴图投影）
- 默认 URL 使用 `about:blank`，用户后续在属性面板填充真实网页地址
- 默认尺寸 640x360（16:9 比例）

**HotspotProperties.vue**
- Web 类型属性面板优化：
  - 宽高字段改为"分辨率宽/高 (px)"，语义更清晰
  - 新增分辨率说明提示（常用：1280×720, 1920×1080, 375×667）
  - 新增"网页地址"输入框，提示需以 http(s):// 开头
  - Web 类型禁用动作选择（跳转场景/打开链接），避免冲突
  - 隐藏混合模式选项（Web 类型不适用）
- 优化默认 style 逻辑：不同类型有各自合理的默认 style，避免历史数据缺字段时显示错乱
  - info: `pulsing-dot`
  - image: `custom-image`
  - web: `custom-web`

**types/index.ts**
- HotspotType 类型定义新增 `'web'` 类型

### 3. 版本信息管理系统
**vite.config.ts**
- 新增 `resolveBuildVersion()` 函数，在构建/开发启动时采集版本信息
- 优先读取 prebuild 脚本生成的 `src/generated/version.json`
- 兜底方案：现场通过 git 命令采集（开发模式/测试环境）
- 版本信息包含：
  - editorCommit: 编辑器 commit hash
  - panoviewCommit: PanoViewV2 commit hash
  - panoviewExists/panoviewIsGitRepo/panoviewDirty: PanoViewV2 状态标识
  - buildTime: 构建时间戳
  - versionHash: FNV-1a 32 位哈希值
- 通过 `define` 注入 `__BUILD_VERSION__` 常量
- 新增 `base` 配置支持，通过环境变量 `VITE_BASE_URL` 指定部署子路径

**buildVersion.ts / buildVersion.node.ts**
- 新增版本信息工具模块，提供版本采集和格式化功能
- 支持 Node.js 环境和浏览器环境

**buildVersion.spec.ts**
- 新增版本信息工具单元测试

**scripts/check-panoview-version.mjs**
- 新增 PanoViewV2 版本检查脚本
- 支持 `--strict` 模式，构建时强制检查 PanoViewV2 版本一致性
- 作为 prebuild 钩子自动执行

**package.json**
- 新增脚本：
  - `prebuild`: 构建前自动执行版本检查
  - `build:strict`: 严格模式构建（强制版本检查）
  - `version:check`: 手动执行版本检查
- 修改 `build:viewer`: 构建前先执行版本检查

### 4. 构建配置优化
**vite.config.viewer.ts**
- Viewer 独立构建配置优化
- 构建产物输出到 `public/static-viewer/`
- 文件名固定（无 hash），方便运行时枚举打入 zip
- 别名配置：`@panoview` → PanoViewV2/src/panoview

**.gitignore**
- 新增 `src/generated/` 忽略规则（构建时生成的版本信息）

**env.d.ts**
- 新增 `__BUILD_VERSION__` 类型声明

### 5. 其他改进
**hotspotFields.ts**
- 优化热点字段处理逻辑

**quadPoints.ts**
- 优化 4 点坐标计算逻辑

**PanoEngineAdapter.ts**
- 引擎适配器优化，支持新的热点类型

**EditorCanvas.vue / LayerPanel.vue / Toolbar.vue**
- UI 组件优化，支持 Web 热点类型

**router/index.ts**
- 路由配置优化

**hotspotFactory.spec.ts / staticPacker.spec.ts**
- 新增/更新单元测试，覆盖新功能

## 技术亮点

1. **路径灵活性**：支持部署到域名根路径、子路径或相对路径，适配多种部署场景
2. **版本可追溯**：打包产物包含 version.json，便于线上问题排查和版本管理
3. **Web 热点**：新增 iframe 嵌入网页热点，支持 4 点透视投影，可嵌入任意网页内容
4. **构建安全**：prebuild 钩子自动检查 PanoViewV2 版本一致性，避免版本不匹配导致的运行时错误
5. **类型安全**：完善 TypeScript 类型定义，新增 `__BUILD_VERSION__` 类型声明

## 文件清单

### 新增文件（7 个）
- `src/utils/buildVersion.ts`: 版本信息工具（浏览器环境）
- `src/utils/buildVersion.node.ts`: 版本信息工具（Node.js 环境）
- `src/utils/buildVersion.spec.ts`: 版本信息工具单元测试
- `scripts/check-panoview-version.mjs`: PanoViewV2 版本检查脚本
- `public/static-viewer/index.html`: Viewer 入口 HTML
- `public/static-viewer/assets/index.css`: Viewer 样式
- `public/static-viewer/assets/index.js`: Viewer 主逻辑
- `public/static-viewer/assets/textureLoader.worker.js`: 纹理加载 Worker

### 修改文件（19 个）
- `src/utils/staticPacker.ts`: 静态打包器路径解析优化
- `src/utils/hotspotFactory.ts`: 新增 Web 热点类型支持
- `src/components/HotspotProperties.vue`: Web 热点属性面板
- `src/types/index.ts`: HotspotType 类型定义
- `vite.config.ts`: 版本信息采集和注入
- `vite.config.viewer.ts`: Viewer 构建配置优化
- `package.json`: 新增构建脚本
- `.gitignore`: 新增忽略规则
- `env.d.ts`: 类型声明
- `static-viewer/main.ts`: Viewer 初始化逻辑
- `src/utils/hotspotFields.ts`: 热点字段处理
- `src/utils/quadPoints.ts`: 4 点坐标计算
- `src/utils/PanoEngineAdapter.ts`: 引擎适配器
- `src/components/EditorCanvas.vue`: 编辑器画布
- `src/components/LayerPanel.vue`: 图层面板
- `src/components/Toolbar.vue`: 工具栏
- `src/router/index.ts`: 路由配置
- `src/utils/hotspotFactory.spec.ts`: 单元测试
- `src/utils/staticPacker.spec.ts`: 单元测试

## 破坏性变更

无

## 迁移指南

无需迁移，新功能向后兼容。

## 测试建议

1. 测试静态化导出功能，验证 version.json 是否正确写入
2. 测试 Web 热点创建和属性编辑
3. 测试部署到子路径场景（设置 `VITE_BASE_URL=/editor/`）
4. 测试版本检查脚本（`npm run version:check`）
5. 测试严格模式构建（`npm run build:strict`）
