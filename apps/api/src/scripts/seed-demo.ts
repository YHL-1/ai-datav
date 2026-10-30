/**
 * 写入演示账号，供登录页「快速体验」使用。
 * 用法：pnpm --filter @nexa/api db:seed
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db, pool } from '../db/client.js'
import { users } from '../db/schema.js'
import { generateId, hashPassword } from '../lib/crypto.js'

const DEMO_EMAIL = 'demo@nexa.studio'
const DEMO_PASSWORD = 'nexa2026'

const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1)

if (existing.length > 0) {
  console.log(`演示账号已存在：${DEMO_EMAIL}`)
} else {
  await db.insert(users).values({
    id: generateId('u'),
    email: DEMO_EMAIL,
    passwordHash: await hashPassword(DEMO_PASSWORD),
    displayName: '陈默',
  })
  console.log(`演示账号已创建：${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
}

await pool.end()
