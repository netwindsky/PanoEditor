import type { ApiResponse, Scene, CreateSceneParams, UpdateSceneParams, TileProgress } from '@/types'
import * as sceneApi from '@/api/scene'

/**
 * 场景数据仓库接口
 * 负责场景相关的数据访问操作
 */
export interface ISceneRepository {
  fetchScenes(projectId: string): Promise<Scene[]>
  fetchScene(projectId: string, sceneId: string): Promise<Scene>
  createScene(projectId: string, params: CreateSceneParams): Promise<Scene>
  updateScene(sceneId: string, params: UpdateSceneParams): Promise<Scene>
  deleteScene(sceneId: string): Promise<void>
  fetchTilingProgress(sceneId: string): Promise<TileProgress>
}

/**
 * 场景数据仓库实现
 */
export class SceneRepository implements ISceneRepository {
  async fetchScenes(projectId: string): Promise<Scene[]> {
    const res = await sceneApi.getScenes(projectId)
    return res.data.data
  }

  async fetchScene(projectId: string, sceneId: string): Promise<Scene> {
    const res = await sceneApi.getScene(projectId, sceneId)
    return res.data.data
  }

  async createScene(projectId: string, params: CreateSceneParams): Promise<Scene> {
    const res = await sceneApi.createScene(projectId, params)
    return res.data.data
  }

  async updateScene(sceneId: string, params: UpdateSceneParams): Promise<Scene> {
    const res = await sceneApi.updateScene(sceneId, params)
    return res.data.data
  }

  async deleteScene(sceneId: string): Promise<void> {
    await sceneApi.deleteScene(sceneId)
  }

  async fetchTilingProgress(sceneId: string): Promise<TileProgress> {
    const res = await sceneApi.getTilingProgress(sceneId)
    return res.data.data
  }
}
