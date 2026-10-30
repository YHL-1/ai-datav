import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  SMTP_HOST: z.string().default('smtp.qq.com'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_EMAIL: z.string().optional(),
  SMTP_AUTH_CODE: z.string().optional(),
  UPLOAD_DIR: z.string().default('uploads'),
})

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  host: string
  port: number
  corsOrigins: string[]
  sessionTtlDays: number
  smtpHost: string
  smtpPort: number
  smtpEmail?: string
  smtpAuthCode?: string
  uploadDir: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env)

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`环境变量配置错误：${details}`)
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    corsOrigins: parsed.data.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
    sessionTtlDays: parsed.data.SESSION_TTL_DAYS,
    smtpHost: parsed.data.SMTP_HOST,
    smtpPort: parsed.data.SMTP_PORT,
    smtpEmail: parsed.data.SMTP_EMAIL || undefined,
    smtpAuthCode: parsed.data.SMTP_AUTH_CODE || undefined,
    uploadDir: parsed.data.UPLOAD_DIR,
  }
}
