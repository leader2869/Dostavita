// Supabase клиент для middleware
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseClientEnv } from '@/lib/config'

export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabaseClientEnv()
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Проверяем и обновляем сессию пользователя
  // Используем getUser() для безопасной проверки аутентификации
  const { data: { user } } = await supabase.auth.getUser()
  
  // Если пользователь не аутентифицирован и пытается зайти в защищенную зону,
  // редирект будет выполнен в layout дашборда

  return supabaseResponse
}
