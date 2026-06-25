import type { ISceneRepository } from '../repositories/SceneRepository'
import type { IResourceRepository } from '../repositories/ResourceRepository'
import type { Scene, CreateSceneParams, UpdateSceneParams, TileProgress } from '@/types'

/**
 * 场景业务服务
 * 封装场景领域的业务逻辑，包括全景图上传、切片进度追踪等
 */
export class SceneService {
  constructor(
    private sceneRepo: ISceneRepository,
    private resourceRepo: IResourceRepository
  ) {}

  async fetchScenes(projectId: string): Promise<Scene[]> {
    return this.sceneRepo.fetchScenes(projectId)
  }

  async createScene(projectId: string, name: string, previewUrl: string): Promise<Scene> {
    return this.sceneRepo.createScene(projectId, { name, previewUrl })
  }

  async updateScene(sceneId: string, params: UpdateSceneParams): Promise<Scene> {
    return this.sceneRepo.updateScene(sceneId, params)
  }

  async deleteScene(sceneId: string): Promise<void> {
    return this.sceneRepo.deleteScene(sceneId)
  }

  /**
   * 上传全景图并创建场景
   * 业务步骤：1.上传文件 2.创建场景
   */
  async uploadPanorama(
    projectId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ scene: Scene }> {
    // 1. 上传文件作为资源
    const resource = await this.resourceRepo.uploadResource(
      projectId,
      file,
      'panorama',
      onProgress
    )

    // 2. 创建场景
    const sceneName = file.name.replace(/\.[^.]+$/, '')
    const scene = await this.createScene(projectId, sceneName, resource.url)

    return { scene }
  }

  async fetchTilingProgress(sceneId: string): Promise<TileProgress> {
    return this.sceneRepo.fetchTilingProgress(sceneId)
  }
}
