import http from './index'
import type { ApiResponse, Resource, ResourceType, BatchUploadResponse } from '@/types'
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

export function batchUploadResources(
  projectId: string,
  files: File[],
  type: ResourceType,
) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  formData.append('type', type)
  return http.post<ApiResponse<BatchUploadResponse>>(`/projects/${projectId}/resources/batch-upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function deleteResource(id: string) {
  return http.delete<ApiResponse<null>>(`/resources/${id}`)
}
