import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { createMailer } from "./lib/mailer.js";
import { registerAuthGuard } from "./plugins/auth-guard.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { authRoutes } from "./routes/auth.js";
import { datasetRoutes } from "./routes/datasets.js";
import { demoLiveRoutes } from "./routes/demoLive.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { projectRoutes } from "./routes/projects.js";
import { uploadRoutes } from "./routes/uploads.js";

export interface BuiltApp {
  app: FastifyInstance;
  config: AppConfig;
}

export async function buildApp(): Promise<BuiltApp> {
  const config = loadConfig();

  const app = Fastify({
    logger: {
      level: config.nodeEnv === "production" ? "info" : "debug",
      transport:
        config.nodeEnv === "development"
          ? {
              target: "pino-pretty",
              options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
            }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });

  registerErrorHandler(app);
  registerAuthGuard(app);

  const mailer = createMailer(config);

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes(config, mailer), { prefix: "/api/auth" });
  await app.register(meRoutes, { prefix: "/api" });
  await app.register(projectRoutes, { prefix: "/api" });
  await app.register(datasetRoutes(config), { prefix: "/api" });
  await app.register(demoLiveRoutes, { prefix: "/api" });
  await app.register(uploadRoutes(config), { prefix: "/api" });

  return { app, config };
}
