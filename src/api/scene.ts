import http from './index'
import type { ApiResponse, Scene, CreateSceneParams, UpdateSceneParams, TileProgress } from '@/types'

export function getScenes(projectId: string) {
  return http.get<ApiResponse<Scene[]>>(`/projects/${projectId}/scenes`)
}

export function getScene(projectId: string, sceneId: string) {
  return http.get<ApiResponse<Scene>>(`/projects/${projectId}/scenes/${sceneId}`)
}

export function createScene(projectId: string, params: CreateSceneParams) {
  return http.post<ApiResponse<Scene>>(`/projects/${projectId}/scenes`, params)
}

export function updateScene(sceneId: string, params: UpdateSceneParams) {
  return http.put<ApiResponse<Scene>>(`/scenes/${sceneId}`, params)
}

export function deleteScene(sceneId: string) {
  return http.delete<ApiResponse<null>>(`/scenes/${sceneId}`)
}

export function getTilingProgress(sceneId: string) {
  return http.get<ApiResponse<TileProgress>>(`/scenes/${sceneId}/tiling-progress`)
}
