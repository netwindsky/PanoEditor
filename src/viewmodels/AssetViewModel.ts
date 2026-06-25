import { ref, reactive } from 'vue'
import type { Resource, ResourceType, ResourceService } from '@/models'

/**
 * 资源 ViewModel
 * 负责资源管理的所有业务逻辑和状态
 */
export class AssetViewModel {
  resources = ref<Resource[]>([])
  uploading = ref(false)
  uploadProgress = ref(0)
  filterType = ref<ResourceType | ''>('')

  constructor(private resourceService: ResourceService) {}

  async loadResources(projectId: string, type?: ResourceType): Promise<void> {
    this.resources.value = await this.resourceService.fetchResources(projectId, type)
  }

  async uploadResource(
    projectId: string,
    file: File,
    type: ResourceType
  ): Promise<void> {
    this.uploading.value = true
    this.uploadProgress.value = 0

    try {
      const resource = await this.resourceService.uploadResource(
        projectId,
        file,
        type,
        (progress) => {
          this.uploadProgress.value = progress
        }
      )
      this.resources.value.push(resource)
    } finally {
      this.uploading.value = false
      this.uploadProgress.value = 0
    }
  }

  async deleteResource(id: string): Promise<void> {
    await this.resourceService.deleteResource(id)
    this.resources.value = this.resources.value.filter((r) => r.id !== id)
  }

  setFilterType(type: ResourceType | ''): void {
    this.filterType.value = type
  }
}
