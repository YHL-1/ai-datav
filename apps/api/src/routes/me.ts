import type { FastifyInstance } from "fastify";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me", async (request, reply) => {
    // authUser 由全局 auth-guard 钩子写入，未登录在这里不可达
    return reply.send({ user: request.authUser });
  });
}
