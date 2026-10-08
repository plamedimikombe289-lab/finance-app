const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const store = {}

export function getCached(key) {
  const entry = store[key]
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { delete store[key]; return null }
  return entry.data
}

export function setCached(key, data) {
  store[key] = { data, ts: Date.now() }
}

export function invalidateCache(key) {
  delete store[key]
}
