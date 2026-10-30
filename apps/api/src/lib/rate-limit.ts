/** 轻量内存限流：单实例部署足够，后续可换 Redis */
const buckets = new Map<string, { count: number; resetAt: number }>()

/** 返回 true 表示本次请求已超限 */
export function takeLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }

  bucket.count += 1
  return bucket.count > limit
}

export function clearLimit(key: string): void {
  buckets.delete(key)
}
