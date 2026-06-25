import http from './index'
import type { ApiResponse, Hotspot, CreateHotspotParams, UpdateHotspotParams } from '@/types'

export function getHotspots(sceneId: string) {
  return http.get<ApiResponse<Hotspot[]>>(`/scenes/${sceneId}/hotspots`)
}

export function createHotspot(sceneId: string, params: CreateHotspotParams) {
  return http.post<ApiResponse<Hotspot>>(`/scenes/${sceneId}/hotspots`, params)
}

export function updateHotspot(hotspotId: string, params: UpdateHotspotParams) {
  return http.put<ApiResponse<Hotspot>>(`/hotspots/${hotspotId}`, params)
}

export function deleteHotspot(hotspotId: string) {
  return http.delete<ApiResponse<null>>(`/hotspots/${hotspotId}`)
}
