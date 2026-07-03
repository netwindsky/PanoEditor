import http from './index'
import type { ApiResponse, PostProcessing, UpdatePostProcessingParams, PostPreset } from '@/types'

export function getPostProcessing(sceneId: string) {
  return http.get<ApiResponse<PostProcessing>>(`/scenes/${sceneId}/post-processing`)
}

export function updatePostProcessing(sceneId: string, params: UpdatePostProcessingParams) {
  return http.put<ApiResponse<PostProcessing>>(`/scenes/${sceneId}/post-processing`, params)
}

export function getPresets() {
  return http.get<ApiResponse<PostPreset[]>>('/post-processing/presets')
}
