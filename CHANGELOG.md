# 更新日志

所有重要的更改都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增
- **场景上传错误处理机制**
  - 在 `SceneList.vue` 中添加上传错误提示组件
  - 在 `SceneViewModel.ts` 中添加 `uploadError` 响应式状态
  - 实现完整的错误捕获和用户提示流程

### 改进
- **上传进度条优化**
  - 为进度条添加 `status="success"` 属性，上传完成时显示绿色状态
  - 优化进度条样式，添加背景色区分
  - 上传完成后保持 100% 进度显示 800ms，提升用户体验

- **上传流程健壮性**
  - 将 `handleFileChange` 改为异步函数，支持 await 上传操作
  - 添加详细的控制台日志记录，便于调试和追踪
  - 在上传失败时正确清理输入框状态
  - 改进错误消息显示，优先显示服务端返回的错误信息

- **代码质量提升**
  - 在 `SceneViewModel.ts` 中添加 `isUploading` 和 `currentUploadProgress` 计算属性
  - 在切片进度轮询中添加错误日志记录
  - 移除空的 catch 块，改为记录错误信息
  - 在 `useAuth.ts` 中补充缺失的 `computed` 导入

### 技术细节
- 修改文件：
  - `src/components/SceneList.vue` - UI 层错误提示和上传流程优化
  - `src/composables/useAuth.ts` - 补充导入
  - `src/viewmodels/SceneViewModel.ts` - 业务逻辑层错误处理和状态管理

### 测试建议
- 测试正常上传流程，验证进度条显示和成功提示
- 测试上传失败场景，验证错误提示是否正确显示
- 测试网络中断情况，验证错误处理机制
- 检查控制台日志输出是否完整
