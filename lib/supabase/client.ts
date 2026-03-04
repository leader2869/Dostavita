// Клиентский Supabase клиент
import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseClientEnv } from '@/lib/config'

export function createClient() {
  const { url, anonKey } = getSupabaseClientEnv()
  return createBrowserClient(url, anonKey)
}
