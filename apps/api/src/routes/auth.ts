import type { FastifyInstance, FastifyReply } from "fastify";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { ERROR_CODES } from "@nexa/schema";
import type { AppConfig } from "../config.js";
import { db } from "../db/client.js";
import { emailVerificationCodes, users } from "../db/schema.js";
import {
  createNumericCode,
  generateId,
  hashCode,
  hashPassword,
  verifyPassword,
} from "../lib/crypto.js";
import { sendError, sendValidationError } from "../lib/http.js";
import type { Mailer } from "../lib/mailer.js";
import { clearLimit, takeLimit } from "../lib/rate-limit.js";
import {
  createSession,
  destroySession,
  SESSION_COOKIE,
} from "../lib/session.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

const emailSchema = z.email();
const passwordSchema = z.string().min(8, "密码至少 8 位").max(72);

const sendCodeSchema = z.object({ email: emailSchema });

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  code: z.string().regex(/^\d{6}$/, "验证码为 6 位数字"),
  displayName: z.string().trim().min(1).max(40).optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function setSessionCookie(
  reply: FastifyReply,
  config: AppConfig,
  token: string,
  expiresAt: Date,
): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    expires: expiresAt,
  });
}

export function authRoutes(config: AppConfig, mailer: Mailer) {
  return async (app: FastifyInstance) => {
    app.post("/send-code", async (request, reply) => {
      const parsed = sendCodeSchema.safeParse(request.body);
      if (!parsed.success)
        return sendValidationError(reply, parsed.error.issues);

      const email = normalizeEmail(parsed.data.email);
      if (takeLimit(`code:${email}`, 1, 60_000)) {
        return sendError(
          reply,
          429,
          ERROR_CODES.RATE_LIMITED,
          "验证码发送过于频繁，请 60 秒后再试",
        );
      }

      // 旧的未使用验证码全部作废
      await db
        .update(emailVerificationCodes)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(emailVerificationCodes.email, email),
            isNull(emailVerificationCodes.consumedAt),
          ),
        );

      const code = createNumericCode();
      const salt = randomBytes(8).toString("hex");

      await db.insert(emailVerificationCodes).values({
        id: generateId("ec"),
        email,
        salt,
        codeHash: hashCode(code, salt),
        purpose: "register",
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });

      let delivered = false;
      if (mailer.configured) {
        try {
          await mailer.sendVerificationCode(email, code);
          delivered = true;
        } catch (error) {
          request.log.error({ err: error }, "验证码邮件发送失败");
          return sendError(
            reply,
            502,
            ERROR_CODES.MAIL_SEND_FAILED,
            "验证码邮件发送失败，请稍后重试",
          );
        }
      } else {
        request.log.info(`[dev] 邮箱验证码 ${email} -> ${code}`);
      }

      return reply.send({
        ok: true,
        delivered,
        // 仅在开发环境且未配置 SMTP 时回传，方便本地联调
        devCode:
          config.nodeEnv !== "production" && !delivered ? code : undefined,
      });
    });

    app.post("/register", async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success)
        return sendValidationError(reply, parsed.error.issues);

      const email = normalizeEmail(parsed.data.email);
      if (takeLimit(`register:${request.ip}`, 5, 15 * 60_000)) {
        return sendError(
          reply,
          429,
          ERROR_CODES.RATE_LIMITED,
          "注册请求过于频繁，请稍后再试",
        );
      }

      const codeRows = await db
        .select()
        .from(emailVerificationCodes)
        .where(
          and(
            eq(emailVerificationCodes.email, email),
            eq(emailVerificationCodes.purpose, "register"),
            isNull(emailVerificationCodes.consumedAt),
            gt(emailVerificationCodes.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(emailVerificationCodes.createdAt))
        .limit(1);

      const codeRow = codeRows[0];
      if (!codeRow) {
        return sendError(
          reply,
          400,
          ERROR_CODES.VALIDATION_ERROR,
          "验证码已失效，请重新获取",
        );
      }

      if (codeRow.attempts >= MAX_CODE_ATTEMPTS) {
        return sendError(
          reply,
          400,
          ERROR_CODES.VALIDATION_ERROR,
          "验证码尝试次数过多，请重新获取",
        );
      }

      if (hashCode(parsed.data.code, codeRow.salt) !== codeRow.codeHash) {
        await db
          .update(emailVerificationCodes)
          .set({ attempts: codeRow.attempts + 1 })
          .where(eq(emailVerificationCodes.id, codeRow.id));
        return sendError(
          reply,
          400,
          ERROR_CODES.VALIDATION_ERROR,
          "验证码不正确",
        );
      }

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing.length > 0) {
        return sendError(
          reply,
          409,
          ERROR_CODES.VALIDATION_ERROR,
          "该邮箱暂不可用，请更换邮箱或直接登录",
        );
      }

      const displayName = parsed.data.displayName ?? email.split("@")[0];
      const userId = generateId("u");

      await db.insert(users).values({
        id: userId,
        email,
        passwordHash: await hashPassword(parsed.data.password),
        displayName,
      });

      await db
        .update(emailVerificationCodes)
        .set({ consumedAt: new Date() })
        .where(eq(emailVerificationCodes.id, codeRow.id));

      const { token, expiresAt } = await createSession(
        userId,
        config.sessionTtlDays,
        request.headers["user-agent"],
      );
      setSessionCookie(reply, config, token, expiresAt);

      return reply
        .status(201)
        .send({ user: { id: userId, email, displayName } });
    });

    app.post("/login", async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success)
        return sendValidationError(reply, parsed.error.issues);

      const email = normalizeEmail(parsed.data.email);
      if (takeLimit(`login:${request.ip}`, 10, 15 * 60_000)) {
        return sendError(
          reply,
          429,
          ERROR_CODES.RATE_LIMITED,
          "登录尝试过于频繁，请 15 分钟后再试",
        );
      }

      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      const user = rows[0];
      if (
        !user ||
        !(await verifyPassword(parsed.data.password, user.passwordHash))
      ) {
        return sendError(
          reply,
          401,
          ERROR_CODES.UNAUTHORIZED,
          "邮箱或密码不正确",
        );
      }

      clearLimit(`login:${request.ip}`);

      const { token, expiresAt } = await createSession(
        user.id,
        config.sessionTtlDays,
        request.headers["user-agent"],
      );
      setSessionCookie(reply, config, token, expiresAt);

      return reply.send({
        user: { id: user.id, email: user.email, displayName: user.displayName },
      });
    });

    app.post("/logout", async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE];
      if (token) await destroySession(token);

      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return reply.send({ ok: true });
    });
  };
}
