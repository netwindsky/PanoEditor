import type { IResourceRepository } from '../repositories/ResourceRepository'
import type { Resource, ResourceType } from '@/types'

/**
 * 资源业务服务
 * 封装资源领域的业务逻辑
 */
export class ResourceService {
  constructor(private repository: IResourceRepository) {}

  async fetchResources(projectId: string, type?: ResourceType): Promise<Resource[]> {
    return this.repository.fetchResources(projectId, type)
  }

  async uploadResource(
    projectId: string,
    file: File,
    type: ResourceType,
    onProgress?: (progress: number) => void
  ): Promise<Resource> {
    return this.repository.uploadResource(projectId, file, type, onProgress)
  }

  async deleteResource(id: string): Promise<void> {
    return this.repository.deleteResource(id)
  }
}
