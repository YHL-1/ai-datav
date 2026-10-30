import type { SessionUser } from '../lib/session.js'

declare module 'fastify' {
  interface FastifyRequest {
    /** 全局鉴权钩子写入；仅受保护路由上有值 */
    authUser?: SessionUser
  }
}
