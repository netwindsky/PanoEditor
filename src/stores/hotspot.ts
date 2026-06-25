import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Hotspot, CreateHotspotParams, UpdateHotspotParams } from '@/types'
import * as hotspotApi from '@/api/hotspot'

/**
 * 热点 Store（兼容层）
 * TODO: 迁移到 HotspotViewModel
 */
export const useHotspotStore = defineStore('hotspot', () => {
  const hotspots = ref<Hotspot[]>([])
  const selectedHotspot = ref<Hotspot | null>(null)
  const loading = ref(false)

  async function fetchHotspots(sceneId: string) {
    loading.value = true
    try {
      const res = await hotspotApi.getHotspots(sceneId)
      hotspots.value = res.data.data
    } finally {
      loading.value = false
    }
  }

  function selectHotspot(hotspotId: string | null) {
    if (!hotspotId) {
      selectedHotspot.value = null
      return
    }
    selectedHotspot.value = hotspots.value.find((h) => h.id === hotspotId) || null
  }

  async function createHotspot(sceneId: string, params: CreateHotspotParams) {
    const res = await hotspotApi.createHotspot(sceneId, params)
    hotspots.value.push(res.data.data)
    return res.data.data
  }

  async function updateHotspot(hotspotId: string, params: UpdateHotspotParams) {
    const res = await hotspotApi.updateHotspot(hotspotId, params)
    const updated = res.data.data
    const index = hotspots.value.findIndex((h) => h.id === hotspotId)
    if (index !== -1) {
      hotspots.value[index] = updated
    }
    if (selectedHotspot.value?.id === hotspotId) {
      selectedHotspot.value = updated
    }
    return updated
  }

  async function deleteHotspot(hotspotId: string) {
    await hotspotApi.deleteHotspot(hotspotId)
    hotspots.value = hotspots.value.filter((h) => h.id !== hotspotId)
    if (selectedHotspot.value?.id === hotspotId) {
      selectedHotspot.value = null
    }
  }

  function clearHotspots() {
    hotspots.value = []
    selectedHotspot.value = null
  }

  return { hotspots, selectedHotspot, loading, fetchHotspots, selectHotspot, createHotspot, updateHotspot, deleteHotspot, clearHotspots }
})
