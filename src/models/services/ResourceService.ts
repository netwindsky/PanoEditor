import type { IResourceRepository } from '../repositories/ResourceRepository'
import type { Resource, ResourceType } from '@/types'

/**
 * 资源业务服务
 * 封装资源领域的业务逻辑
 */
export class ResourceService {
  constructor(private repository: IResourceRepository) {}

  async fetchResources(projectId: string, type?: ResourceType): Promise<Resource[]> {
    const resources = await this.repository.fetchResources(projectId, type)
    // 当不指定 type 时，排除全景图资源。
    // 全景图由 SceneService 管理，上传时存入资源表但不应作为普通资源展示。
    if (type === undefined) {
      return resources.filter((r) => r.type !== 'panorama')
    }
    return resources
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
