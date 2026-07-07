/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/** 构建时注入的版本信息（由 vite.config.ts define 选项提供） */
declare const __BUILD_VERSION__: {
  editorCommit: string
  panoviewCommit: string
  panoviewExists: boolean
  panoviewIsGitRepo: boolean
  panoviewDirty: boolean
  buildTime: string
  versionHash: string
}
