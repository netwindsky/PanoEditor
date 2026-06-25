import type { IProjectRepository } from '../repositories/ProjectRepository'
import type { Project, CreateProjectParams, UpdateProjectParams } from '@/types'

/**
 * 项目业务服务
 * 封装项目领域的业务逻辑
 */
export class ProjectService {
  constructor(private repository: IProjectRepository) {}

  async loadProject(id: string): Promise<Project> {
    return this.repository.fetchProject(id)
  }

  async saveProject(id: string, params: UpdateProjectParams): Promise<Project> {
    return this.repository.updateProject(id, params)
  }

  async createProject(params: CreateProjectParams): Promise<Project> {
    return this.repository.createProject(params)
  }

  async deleteProject(id: string): Promise<void> {
    return this.repository.deleteProject(id)
  }

  async publishProject(id: string): Promise<string> {
    const result = await this.repository.publishProject(id)
    return result.publishUrl
  }
}
