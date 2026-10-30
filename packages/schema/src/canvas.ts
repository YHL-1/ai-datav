/**
 * 画布 Schema：固定 1920×1080、主题与组件列表（计划书 6.2）。
 */
import { z } from 'zod'
import { CANVAS_HEIGHT, CANVAS_WIDTH, canvasComponentSchema, colorSchema, MAX_COMPONENTS } from './component.js'

export const SCHEMA_VERSION = '1.0'

export const canvasConfigSchema = z.object({
  width: z.literal(CANVAS_WIDTH),
  height: z.literal(CANVAS_HEIGHT),
  background: colorSchema.default('#05090F'),
  grid: z.number().int().min(1).max(64).default(8),
})

export const themeSchema = z.object({
  preset: z.string().min(1).max(40).default('deep-space'),
  primary: colorSchema.default('#5EF2C2'),
  accent: colorSchema.default('#54C8E8'),
})

export type CanvasTheme = z.infer<typeof themeSchema>

export const canvasSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  canvas: canvasConfigSchema,
  theme: themeSchema,
  components: z.array(canvasComponentSchema).max(MAX_COMPONENTS),
})

export type CanvasSchema = z.infer<typeof canvasSchema>

/** 新项目默认画布 */
export function createEmptyCanvas(): CanvasSchema {
  return {
    schemaVersion: SCHEMA_VERSION,
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: '#05090F', grid: 8 },
    theme: { preset: 'deep-space', primary: '#5EF2C2', accent: '#54C8E8' },
    components: [],
  }
}
