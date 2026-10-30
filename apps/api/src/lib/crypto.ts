import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

const KEY_LENGTH = 32

/** 生成业务 ID，例如 u_ab12... / s_ab12... */
export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(10).toString('hex')}`
}

/** 密码哈希：scrypt$salt$hash */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  return `scrypt$${salt}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false

  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  const expected = Buffer.from(hash, 'hex')

  return expected.length === derived.length && timingSafeEqual(derived, expected)
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** 6 位数字验证码 */
export function createNumericCode(): string {
  return String(randomInt(100_000, 1_000_000))
}

export function hashCode(code: string, salt: string): string {
  return sha256(`${salt}:${code}`)
}
