import { api } from './api'
import type { CanvasSchema, ProjectDetail, ProjectSummary, ProjectType } from '@nexa/schema'

export interface ListProjectsParams {
  type?: ProjectType
  search?: string
  limit?: number
}

export async function listProjects(params: ListProjectsParams = {}): Promise<ProjectSummary[]> {
  const res = await api<{ projects: ProjectSummary[] }>('/projects', {
    query: {
      type: params.type ?? 'draft',
      ...(params.search ? { search: params.search } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
    },
  })
  return res.projects
}

export async function createProject(input: { name: string; canvas?: CanvasSchema }): Promise<ProjectDetail> {
  const res = await api<{ project: ProjectDetail }>('/projects', {
    method: 'POST',
    body: { name: input.name, type: 'draft', ...(input.canvas ? { canvas: input.canvas } : {}) },
  })
  return res.project
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const res = await api<{ project: ProjectDetail }>(`/projects/${id}`)
  return res.project
}

export async function saveProject(
  id: string,
  input: { revision: number; name?: string; canvas?: CanvasSchema },
): Promise<ProjectDetail> {
  const res = await api<{ project: ProjectDetail }>(`/projects/${id}`, {
    method: 'PUT',
    body: input,
  })
  return res.project
}

export async function deleteProject(id: string): Promise<void> {
  await api(`/projects/${id}`, { method: 'DELETE' })
}
