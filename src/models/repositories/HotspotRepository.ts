import type { Hotspot, CreateHotspotParams, UpdateHotspotParams } from '@/types'
import * as hotspotApi from '@/api/hotspot'

/**
 * 热点数据仓库接口
 * 负责热点相关的数据访问操作
 */
export interface IHotspotRepository {
  fetchHotspots(sceneId: string): Promise<Hotspot[]>
  createHotspot(sceneId: string, params: CreateHotspotParams): Promise<Hotspot>
  updateHotspot(hotspotId: string, params: UpdateHotspotParams): Promise<Hotspot>
  deleteHotspot(hotspotId: string): Promise<void>
}

/**
 * 热点数据仓库实现
 */
export class HotspotRepository implements IHotspotRepository {
  async fetchHotspots(sceneId: string): Promise<Hotspot[]> {
    const res = await hotspotApi.getHotspots(sceneId)
    return res.data.data
  }

  async createHotspot(sceneId: string, params: CreateHotspotParams): Promise<Hotspot> {
    const res = await hotspotApi.createHotspot(sceneId, params)
    return res.data.data
  }

  async updateHotspot(hotspotId: string, params: UpdateHotspotParams): Promise<Hotspot> {
    const res = await hotspotApi.updateHotspot(hotspotId, params)
    return res.data.data
  }

  async deleteHotspot(hotspotId: string): Promise<void> {
    await hotspotApi.deleteHotspot(hotspotId)
  }
}
