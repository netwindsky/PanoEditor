import http from './index'
import type { ApiResponse, LutResource } from '@/types'

/** 获取项目下的 LUT 列表 */
export function getLuts(projectId: string) {
  return http.get<ApiResponse<LutResource[]>>(`/projects/${projectId}/luts`)
}

/** 上传 LUT 文件（.cube / .png） */
export function uploadLut(
  projectId: string,
  file: File,
  name?: string,
  description?: string,
) {
  const formData = new FormData()
  formData.append('file', file)
  if (name) formData.append('name', name)
  if (description) formData.append('description', description)
  return http.post<ApiResponse<LutResource>>(`/projects/${projectId}/luts/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 获取单个 LUT 详情 */
export function getLut(id: string) {
  return http.get<ApiResponse<LutResource>>(`/luts/${id}`)
}

/** 删除 LUT */
export function deleteLut(id: string) {
  return http.delete<ApiResponse<null>>(`/luts/${id}`)
}

/** 获取全局 LUT 列表 */
export function getAllLuts() {
  return http.get<ApiResponse<LutResource[]>>('/luts')
}

/** 上传全局 LUT 文件（不绑定项目） */
export function uploadLutGlobal(
  file: File,
  name?: string,
  description?: string,
) {
  const formData = new FormData()
  formData.append('file', file)
  if (name) formData.append('name', name)
  if (description) formData.append('description', description)
  return http.post<ApiResponse<LutResource>>('/luts/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
