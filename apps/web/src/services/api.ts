import { ofetch } from 'ofetch'

export interface ApiErrorPayload {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** 未登录事件名：供 main.ts 统一处理跳转登录页 */
export const UNAUTHORIZED_EVENT = 'nexa:unauthorized'

/** 认证类接口的 401 属于正常业务反馈，不触发全局跳转 */
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/send-code', '/auth/logout', '/me']

function isAuthPath(url: string): boolean {
  return AUTH_PATHS.some((path) => url.includes(path))
}

/**
 * 全局 HTTP 客户端：Cookie Session 由浏览器自动携带，前端不存 token。
 * 后端统一错误结构见 packages/schema/src/errors.ts。
 */
export const api = ofetch.create({
  baseURL: import.meta.env.VITE_API_BASE ?? '/api',
  credentials: 'include',
  retry: 0,
  async onResponseError({ request, response }) {
    const payload = response._data as ApiErrorPayload | undefined
    const error = payload?.error

    // 受保护接口返回 401：会话已失效，统一交给全局监听器跳转登录
    if (response.status === 401 && !isAuthPath(String(request))) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }

    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? '请求失败，请稍后重试',
      error?.details,
    )
  },
})
