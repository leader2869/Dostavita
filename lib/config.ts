/**
 * Централизованный доступ к переменным окружения.
 * Используйте эти константы вместо прямого process.env для единообразия и типизации.
 *
 * Обязательные для работы приложения:
 * - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (клиент и сервер)
 * - SUPABASE_SERVICE_ROLE_KEY (только сервер: admin API, миграции, скрипты)
 *
 * Опциональные:
 * - NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (push-уведомления)
 * - NEXT_PUBLIC_APP_URL (редиректы, письма)
 */

function getEnv(key: string): string | undefined {
  return process.env[key]
}

/** URL проекта Supabase (публичный) */
export const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL')

/** Anon key Supabase (публичный, безопасен для клиента) */
export const SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

const SUPABASE_CLIENT_MESSAGE =
  'NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY должны быть заданы в .env.local. Настройки: https://supabase.com/dashboard/project/_/settings/api'

/**
 * Возвращает { url, anonKey } для создания Supabase-клиента. Выбрасывает ошибку, если переменные не заданы.
 * В браузере сначала проверяет window.__SUPABASE_ENV__ (заполняется SupabaseEnvLoader из /api/supabase-config).
 */
export function getSupabaseClientEnv(): { url: string; anonKey: string } {
  if (typeof window !== 'undefined' && (window as any).__SUPABASE_ENV__) {
    const env = (window as any).__SUPABASE_ENV__ as { url?: string; anonKey?: string }
    if (env.url && env.anonKey) return { url: env.url, anonKey: env.anonKey }
  }
  const url = SUPABASE_URL
  const anonKey = SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(`Supabase: ${SUPABASE_CLIENT_MESSAGE}`)
  }
  return { url, anonKey }
}

/** Service role key (только сервер, не экспонировать клиенту) */
export const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY')

/** Публичный VAPID ключ для push-уведомлений */
export const VAPID_PUBLIC_KEY = getEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY')

/** Приватный VAPID ключ (только сервер) */
export const VAPID_PRIVATE_KEY = getEnv('VAPID_PRIVATE_KEY')

/** Базовый URL приложения */
export const APP_URL = getEnv('NEXT_PUBLIC_APP_URL')

/**
 * Проверяет наличие обязательных переменных. Вызывать при старте серверных скриптов
 * или в API-роутах, где без них работа невозможна.
 * В Next.js не вызывать в модульной области при статической генерации.
 */
export function assertRequiredEnv(keys: { url: string; serviceRole: string } = { url: 'NEXT_PUBLIC_SUPABASE_URL', serviceRole: 'SUPABASE_SERVICE_ROLE_KEY' }): void {
  const url = getEnv(keys.url)
  const serviceRole = getEnv(keys.serviceRole)
  if (!url || !serviceRole) {
    const missing = [(!url && keys.url), (!serviceRole && keys.serviceRole)].filter(Boolean)
    throw new Error(`Отсутствуют переменные окружения: ${missing.join(', ')}. Проверьте .env.local и .env.example.`)
  }
}
