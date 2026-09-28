import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseClientEnv } from '@/lib/config'

/** Только для серверных операций после проверки прав пользователя. */
export function createAdminSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY не настроен')
  return createClient(getSupabaseClientEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
