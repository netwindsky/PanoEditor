import http from './index'
import type { ApiResponse, Resource, ResourceType } from '@/types'
import type { AxiosProgressEvent } from 'axios'

export function getResources(projectId: string, type?: ResourceType) {
  return http.get<ApiResponse<Resource[]>>(`/projects/${projectId}/resources`, {
    params: type ? { type } : {},
  })
}

export function uploadResource(
  projectId: string,
  file: File,
  type: ResourceType,
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void,
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', type)
  return http.post<ApiResponse<Resource>>(`/projects/${projectId}/resources/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })
}

export function deleteResource(id: string) {
  return http.delete<ApiResponse<null>>(`/resources/${id}`)
}
