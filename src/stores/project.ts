import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Project } from '@/types'
import * as projectApi from '@/api/project'

/**
 * 项目 Store（兼容层）
 * TODO: 迁移到 ProjectService + ViewModel
 */
export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const loading = ref(false)

  async function fetchProjects() {
    loading.value = true
    try {
      const res = await projectApi.getProjects()
      projects.value = res.data.data.records
    } finally {
      loading.value = false
    }
  }

  async function fetchProject(id: string) {
    loading.value = true
    try {
      const res = await projectApi.getProject(id)
      currentProject.value = res.data.data
    } finally {
      loading.value = false
    }
  }

  async function saveProject() {
    if (!currentProject.value) return
    await projectApi.updateProject(currentProject.value.id, {})
  }

  async function publishProject() {
    if (!currentProject.value) return
    return projectApi.publishProject(currentProject.value.id)
  }

  function clearCurrentProject() {
    currentProject.value = null
  }

  return { projects, currentProject, loading, fetchProjects, fetchProject, saveProject, publishProject, clearCurrentProject }
})
