import http from './index'
import type { ApiResponse, AudioSettings, UpdateAudioSettingsParams } from '@/types'

export function getAudioSettings(sceneId: string) {
  return http.get<ApiResponse<AudioSettings>>(`/scenes/${sceneId}/audio`)
}

export function updateAudioSettings(sceneId: string, params: UpdateAudioSettingsParams) {
  return http.put<ApiResponse<AudioSettings>>(`/scenes/${sceneId}/audio`, params)
}
