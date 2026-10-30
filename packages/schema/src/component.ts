/**
 * 组件 Schema：组件类型白名单、画布 frame、样式、数据绑定。
 * 前后端与 AI 输出校验共用同一份定义（计划书 3.5 单一 Schema 源）。
 */
import { z } from 'zod'

export const CANVAS_WIDTH = 1920
export const CANVAS_HEIGHT = 1080

/** 组件最小宽高（计划书 F-09 校验规则） */
export const MIN_COMPONENT_WIDTH = 40
export const MIN_COMPONENT_HEIGHT = 24

/** 组件数量上限 */
export const MAX_COMPONENTS = 30

/** 组件类型白名单（计划书 5.F-06 组件清单） */
export const COMPONENT_TYPES = [
  'metric',
  'chart.line',
  'chart.bar',
  'chart.pie',
  'chart.area',
  'map.geo',
  'table',
  'text',
  'image',
  'decor',
] as const

export const componentTypeSchema = z.enum(COMPONENT_TYPES)
export type ComponentType = z.infer<typeof componentTypeSchema>

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RGBA_COLOR = /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)$/

/** 只允许 Hex 或 rgba() 颜色，避免任意 CSS 注入 */
export const colorSchema = z
  .string()
  .refine((value) => HEX_COLOR.test(value) || RGBA_COLOR.test(value), {
    message: '颜色必须是合法的 Hex 或 rgba 值',
  })

export const frameSchema = z
  .object({
    x: z.number().min(0).max(CANVAS_WIDTH),
    y: z.number().min(0).max(CANVAS_HEIGHT),
    w: z.number().min(MIN_COMPONENT_WIDTH).max(CANVAS_WIDTH),
    h: z.number().min(MIN_COMPONENT_HEIGHT).max(CANVAS_HEIGHT),
  })
  .refine((frame) => frame.x + frame.w <= CANVAS_WIDTH, {
    message: `组件右边界超出画布 ${CANVAS_WIDTH}px`,
  })
  .refine((frame) => frame.y + frame.h <= CANVAS_HEIGHT, {
    message: `组件下边界超出画布 ${CANVAS_HEIGHT}px`,
  })

export type ComponentFrame = z.infer<typeof frameSchema>

export const COMPONENT_VARIANTS = [
  'card',
  'glass',
  'outline',
  'minimal',
  'solid',
  'holo',
  'neon',
  'panel',
  'aurora',
] as const
export type ComponentVariant = (typeof COMPONENT_VARIANTS)[number]

export const componentStyleSchema = z.object({
  /** 样式模板：card 卡片 / glass 玻璃 / outline 描边 / minimal 极简 / solid 色块 /
   * holo 全息 / neon 霓虹 / panel 舱体 / aurora 极光 */
  variant: z.enum(COMPONENT_VARIANTS).optional(),
  fill: colorSchema.optional(),
  border: z.string().max(120).optional(),
  radius: z.number().min(0).max(200).optional(),
  opacity: z.number().min(0).max(1).optional(),
  fontFamily: z.string().max(60).optional(),
  fontSize: z.number().min(8).max(200).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  color: colorSchema.optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
})

export type ComponentStyle = z.infer<typeof componentStyleSchema>

/** 格式化 DSL 白名单：number / percent / date / truncate / prefix / suffix / slice / sortBy / map */
export const formatterSchema = z.string().max(80).optional()

export const componentBindingSchema = z.object({
  sourceId: z.string().min(1),
  path: z.string().max(200).default(''),
  fields: z.record(z.string(), z.string()).default({}),
  formatter: formatterSchema,
  refresh: z.number().int().min(0).max(3600).default(30),
})

export type ComponentBinding = z.infer<typeof componentBindingSchema>

/** 递归检查 props 中是否出现脚本类字段，AI 与用户输入都必须通过 */
const UNSAFE_KEY_PATTERN = /^on[a-z]+$/i
const UNSAFE_VALUE_PATTERN = /(?:javascript|vbscript|data:text\/html|<script)/i

export function containsUnsafeContent(value: unknown, depth = 0): boolean {
  if (depth > 8) return false
  if (typeof value === 'string') return UNSAFE_VALUE_PATTERN.test(value)
  if (Array.isArray(value)) return value.some((item) => containsUnsafeContent(item, depth + 1))
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, item]) => UNSAFE_KEY_PATTERN.test(key) || key === 'html' || containsUnsafeContent(item, depth + 1),
    )
  }
  return false
}

export const componentPropsSchema = z
  .record(z.string(), z.unknown())
  .default({})
  .refine((props) => !containsUnsafeContent(props), {
    message: 'props 中不允许出现 html、script 或 on* 事件字段',
  })

export const canvasComponentSchema = z.object({
  id: z.string().min(1).max(64),
  type: componentTypeSchema,
  name: z.string().min(1).max(60),
  frame: frameSchema,
  zIndex: z.number().int(),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  props: componentPropsSchema,
  style: componentStyleSchema.default({}),
  binding: componentBindingSchema.optional(),
})

export type CanvasComponent = z.infer<typeof canvasComponentSchema>
