import type { Resource, ResourceType, BatchUploadResponse } from '@/types'
import type { AxiosProgressEvent } from 'axios'
import * as resourceApi from '@/api/resource'

/**
 * 资源数据仓库接口
 * 负责资源相关的数据访问操作
 */
export interface IResourceRepository {
  fetchResources(projectId: string, type?: ResourceType): Promise<Resource[]>
  uploadResource(
    projectId: string,
    file: File,
    type: ResourceType,
    onProgress?: (progress: number) => void
  ): Promise<Resource>
  batchUploadResources(
    projectId: string,
    files: File[],
    type: ResourceType
  ): Promise<BatchUploadResponse>
  deleteResource(id: string): Promise<void>
}

/**
 * 资源数据仓库实现
 */
export class ResourceRepository implements IResourceRepository {
  async fetchResources(projectId: string, type?: ResourceType): Promise<Resource[]> {
    const res = await resourceApi.getResources(projectId, type)
    return res.data.data
  }

  async uploadResource(
    projectId: string,
    file: File,
    type: ResourceType,
    onProgress?: (progress: number) => void
  ): Promise<Resource> {
    const res = await resourceApi.uploadResource(
      projectId,
      file,
      type,
      onProgress
        ? (event: AxiosProgressEvent) => {
            if (event.total) {
              onProgress(Math.round((event.loaded * 100) / event.total))
            }
          }
        : undefined
    )
    return res.data.data
  }

  async batchUploadResources(
    projectId: string,
    files: File[],
    type: ResourceType
  ): Promise<BatchUploadResponse> {
    const res = await resourceApi.batchUploadResources(projectId, files, type)
    return res.data.data
  }

  async deleteResource(id: string): Promise<void> {
    await resourceApi.deleteResource(id)
  }
}
