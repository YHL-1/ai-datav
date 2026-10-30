import type { FastifyReply } from 'fastify'
import { ERROR_CODES } from '@nexa/schema'

export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return reply.status(status).send({ error: { code, message, details } })
}

export function sendValidationError(reply: FastifyReply, issues: unknown) {
  return sendError(reply, 400, ERROR_CODES.VALIDATION_ERROR, '请求参数不合法', issues)
}
