const buckets = new Map<string, { count: number; resetAt: number }>()

/** Fixed-window limiter kept in memory; adequate for a single-instance deployment. */
export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}
