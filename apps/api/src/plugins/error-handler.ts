import type { FastifyError, FastifyInstance } from 'fastify'
import { ERROR_CODES } from '@nexa/schema'

/** 统一错误结构（计划书 6.4） */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: `路由不存在：${request.method} ${request.url}`,
      },
    })
  })

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500

    if (status >= 500) {
      request.log.error({ err: error }, 'unhandled error')
    }

    reply.status(status).send({
      error: {
        code: status >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.VALIDATION_ERROR,
        message: status >= 500 ? '服务器内部错误' : error.message,
      },
    })
  })
}
