import type { IHotspotRepository } from '../repositories/HotspotRepository'
import type { Hotspot, CreateHotspotParams, UpdateHotspotParams } from '@/types'

/**
 * 热点业务服务
 * 封装热点领域的业务逻辑
 */
export class HotspotService {
  constructor(private repository: IHotspotRepository) {}

  async fetchHotspots(sceneId: string): Promise<Hotspot[]> {
    return this.repository.fetchHotspots(sceneId)
  }

  async createHotspot(sceneId: string, params: CreateHotspotParams): Promise<Hotspot> {
    return this.repository.createHotspot(sceneId, params)
  }

  async updateHotspot(hotspotId: string, params: UpdateHotspotParams): Promise<Hotspot> {
    return this.repository.updateHotspot(hotspotId, params)
  }

  async deleteHotspot(hotspotId: string): Promise<void> {
    return this.repository.deleteHotspot(hotspotId)
  }
}
