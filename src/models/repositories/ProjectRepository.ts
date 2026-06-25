import type { ApiResponse, Project, CreateProjectParams, UpdateProjectParams, PaginatedData } from '@/types'
import * as projectApi from '@/api/project'

/**
 * 项目数据仓库接口
 * 负责项目相关的数据访问操作
 */
export interface IProjectRepository {
  fetchProjects(current?: number, size?: number, keyword?: string): Promise<Project[]>
  fetchProject(id: string): Promise<Project>
  createProject(params: CreateProjectParams): Promise<Project>
  updateProject(id: string, params: UpdateProjectParams): Promise<Project>
  deleteProject(id: string): Promise<void>
  publishProject(id: string): Promise<{ publishUrl: string }>
}

/**
 * 项目数据仓库实现
 */
export class ProjectRepository implements IProjectRepository {
  async fetchProjects(current = 1, size = 20, keyword?: string): Promise<Project[]> {
    const res = await projectApi.getProjects(current, size, keyword)
    return res.data.data.records
  }

  async fetchProject(id: string): Promise<Project> {
    const res = await projectApi.getProject(id)
    return res.data.data
  }

  async createProject(params: CreateProjectParams): Promise<Project> {
    const res = await projectApi.createProject(params)
    return res.data.data
  }

  async updateProject(id: string, params: UpdateProjectParams): Promise<Project> {
    const res = await projectApi.updateProject(id, params)
    return res.data.data
  }

  async deleteProject(id: string): Promise<void> {
    await projectApi.deleteProject(id)
  }

  async publishProject(id: string): Promise<{ publishUrl: string }> {
    const res = await projectApi.publishProject(id)
    return res.data.data
  }
}
