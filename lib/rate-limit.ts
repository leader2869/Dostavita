/**
 * Простой in-memory rate limiter для API (например, Nominatim).
 * Не подходит для нескольких инстансов (использовать Redis в продакшене при масштабировании).
 */

const store = new Map<string, number[]>()
const DEFAULT_WINDOW_MS = 1000
const DEFAULT_MAX_REQUESTS = 1

/**
 * Проверяет лимит: не более maxRequests запросов в окне windowMs для ключа key.
 * Возвращает true, если запрос разрешён; false — если лимит превышен.
 * Удаляет устаревшие метки времени.
 */
export function checkRateLimit(
  key: string,
  options: { windowMs?: number; maxRequests?: number } = {}
): boolean {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS
  const now = Date.now()
  const cutoff = now - windowMs

  let timestamps = store.get(key) ?? []
  timestamps = timestamps.filter((t) => t > cutoff)

  if (timestamps.length >= maxRequests) return false

  timestamps.push(now)
  store.set(key, timestamps)
  return true
}

/**
 * Получает IP из NextRequest (заголовки X-Forwarded-For / X-Real-IP или connection).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}
