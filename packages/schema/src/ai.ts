/**
 * AI 输出协议（计划书 F-09）：模型只返回受控组件 Schema，不允许 HTML/JS。
 */
import { z } from 'zod'
import { canvasComponentSchema, MAX_COMPONENTS } from './component.js'
import { themeSchema } from './canvas.js'

export const AI_MODES = ['replace', 'append', 'edit'] as const
export const aiModeSchema = z.enum(AI_MODES)

export const aiResponseSchema = z.object({
  mode: aiModeSchema,
  message: z.string().min(1).max(200),
  theme: themeSchema.optional(),
  components: z.array(canvasComponentSchema).max(MAX_COMPONENTS),
  warnings: z.array(z.string().max(200)).default([]),
})

export type AIResponse = z.infer<typeof aiResponseSchema>

export const aiGenerateRequestSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1).max(2000),
})

export const aiEditRequestSchema = z.object({
  projectId: z.string().min(1),
  componentId: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  applyMode: z.enum(['replace', 'append']).default('replace'),
})

export const aiUsageSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  used: z.number().int().min(0),
  limit: z.number().int().min(0),
})

export type AIUsage = z.infer<typeof aiUsageSchema>
