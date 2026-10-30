import type { FastifyInstance } from "fastify";
import { ERROR_CODES } from "@nexa/schema";
import { resolveSession, SESSION_COOKIE } from "../lib/session.js";

/** 无需登录即可访问的接口前缀 */
const PUBLIC_PREFIXES = [
  "/api/health",
  "/api/auth/",
  "/api/demo/live/",
  "/api/assets/",
];

/**
 * 全站未登录拦截：除公开接口外，所有 /api 路由默认要求有效会话。
 * 后续新增 projects / data-sources / ai 路由无需单独加鉴权。
 */
export function registerAuthGuard(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];

    if (!path.startsWith("/api")) return;
    if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return;

    const session = await resolveSession(request.cookies[SESSION_COOKIE]);

    if (!session) {
      return reply.status(401).send({
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: "未登录或登录已失效",
        },
      });
    }

    request.authUser = session;
  });
}
