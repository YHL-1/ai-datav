/**
 * 统一错误结构与错误码（计划书 6.4）。
 */
import { z } from 'zod'

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PROJECT_REVISION_CONFLICT: 'PROJECT_REVISION_CONFLICT',
  AI_SCHEMA_INVALID: 'AI_SCHEMA_INVALID',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  CORS_BLOCKED: 'CORS_BLOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  MAIL_SEND_FAILED: 'MAIL_SEND_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
})

export type ApiErrorBody = z.infer<typeof apiErrorSchema>
