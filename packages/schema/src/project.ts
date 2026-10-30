/**
 * 草稿 / 私有模板的接口契约（计划书 F-02 / F-04）。
 * 前端与后端共用，保存时用 revision 做乐观锁。
 */
import { z } from 'zod'
import { canvasSchema } from './canvas.js'

export const projectTypeSchema = z.enum(['draft', 'template'])
export type ProjectType = z.infer<typeof projectTypeSchema>

export const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: projectTypeSchema,
  revision: z.number().int().min(1),
  componentCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ProjectSummary = z.infer<typeof projectSummarySchema>

export const projectDetailSchema = projectSummarySchema.extend({
  canvas: canvasSchema,
})

export type ProjectDetail = z.infer<typeof projectDetailSchema>

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(80).default('未命名智慧屏'),
  type: z.literal('draft').default('draft'),
  canvas: canvasSchema.optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>

/** 保存：revision 必须等于库中当前值，否则返回 409 冲突 */
export const updateProjectInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    canvas: canvasSchema.optional(),
    revision: z.number().int().min(1),
  })
  .refine((value) => value.name !== undefined || value.canvas !== undefined, {
    message: '至少需要提交 name 或 canvas',
  })

export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>

export const projectListQuerySchema = z.object({
  type: projectTypeSchema.default('draft'),
  search: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>
