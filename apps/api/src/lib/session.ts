import { randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '../db/client.js'
import { sessions, users } from '../db/schema.js'
import { generateId, sha256 } from './crypto.js'

export const SESSION_COOKIE = 'nexa_session'

export interface SessionUser {
  id: string
  email: string
  displayName: string
}

export function hashSessionToken(token: string): string {
  return sha256(`session:${token}`)
}

export async function createSession(
  userId: string,
  ttlDays: number,
  userAgent?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

  await db.insert(sessions).values({
    id: generateId('s'),
    userId,
    tokenHash: hashSessionToken(token),
    userAgent: userAgent?.slice(0, 255) ?? null,
    expiresAt,
  })

  return { token, expiresAt }
}

export async function resolveSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashSessionToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1)

  const row = rows[0]
  return row ? { id: row.userId, email: row.email, displayName: row.displayName } : null
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)))
}
