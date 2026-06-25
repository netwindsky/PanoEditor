import http from './index'
import type { ApiResponse, Project, CreateProjectParams, UpdateProjectParams, PaginatedData } from '@/types'

export function getProjects(current = 1, size = 20, keyword?: string) {
  return http.get<ApiResponse<PaginatedData<Project>>>('/projects', {
    params: { current, size, keyword },
  })
}

export function getProject(id: string) {
  return http.get<ApiResponse<Project>>(`/projects/${id}`)
}

export function createProject(params: CreateProjectParams) {
  return http.post<ApiResponse<Project>>('/projects', params)
}

export function updateProject(id: string, params: UpdateProjectParams) {
  return http.put<ApiResponse<Project>>(`/projects/${id}`, params)
}

export function deleteProject(id: string) {
  return http.delete<ApiResponse<null>>(`/projects/${id}`)
}

export function publishProject(id: string) {
  return http.post<ApiResponse<{ publishUrl: string }>>(`/projects/${id}/publish`)
}

export function unpublishProject(id: string) {
  return http.post<ApiResponse<null>>(`/projects/${id}/unpublish`)
}
