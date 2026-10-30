/**
 * 数据源配置 Schema（计划书 F-03）：只保存只读接口配置，不保存业务数据。
 */
import { z } from 'zod'

export const DATA_SOURCE_AUTH_TYPES = ['none', 'bearer', 'header'] as const
export const dataSourceAuthTypeSchema = z.enum(DATA_SOURCE_AUTH_TYPES)

/** 只读接口，MVP 只支持 GET */
export const dataSourceConfigSchema = z.object({
  name: z.string().min(1).max(40),
  url: z.url(),
  method: z.literal('GET').default('GET'),
  timeoutMs: z.number().int().min(1000).max(30000).default(8000),
  authType: dataSourceAuthTypeSchema.default('none'),
  headers: z.record(z.string(), z.string()).default({}),
  refreshInterval: z.number().int().min(0).max(3600).default(30),
})

export type DataSourceConfig = z.infer<typeof dataSourceConfigSchema>

/** 列表/详情响应中的数据源，Token 永远不下发 */
export const dataSourceSummarySchema = dataSourceConfigSchema.extend({
  id: z.string().min(1),
  hasSecret: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type DataSourceSummary = z.infer<typeof dataSourceSummarySchema>
