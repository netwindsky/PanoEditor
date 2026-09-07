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
    // 后端默认已只返回 image/video/audio 标注资源；此处保留防御性过滤，
    // 排除 panorama/document/other 等无意义资源以及 URL 为空的脏数据。
    // model：模型热点资源，供模型热点从资源库选择 .glb/.gltf 文件。
    return resources.filter((r) => {
      const t = r.type?.toLowerCase()
      return r.url && ['image', 'video', 'audio', 'model'].includes(t)
    })
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
