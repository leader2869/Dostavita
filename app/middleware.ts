import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Обновляем сессию Supabase
  const response = await updateSession(request)

  // Защищаем маршруты дашборда
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const supabase = await import('@/lib/supabase/middleware').then(m => 
      m.updateSession(request)
    )
    
    // Проверка аутентификации будет в layout дашборда
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

