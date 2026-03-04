// Серверный Supabase клиент
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseClientEnv } from '@/lib/config'

export function createServerSupabaseClient() {
  const { url, anonKey } = getSupabaseClientEnv()
  const cookieStore = cookies()

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
