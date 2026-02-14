import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  
  try {
    // Выходим из аккаунта
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Ошибка при выходе:', error)
    }
  } catch (err) {
    console.error('Исключение при выходе:', err)
  }
  
  // Получаем базовый URL из заголовков запроса
  const origin = request.headers.get('origin') || request.nextUrl.origin
  const loginUrl = new URL('/login', origin)
  
  // Добавляем параметр для принудительной перезагрузки страницы
  loginUrl.searchParams.set('signedOut', 'true')
  
  // Создаем редирект с очисткой cookies
  const response = NextResponse.redirect(loginUrl)
  
  // Очищаем cookies сессии Supabase
  response.cookies.delete('sb-access-token')
  response.cookies.delete('sb-refresh-token')
  
  // Очищаем все cookies, связанные с Supabase
  const cookies = request.cookies.getAll()
  cookies.forEach(cookie => {
    if (cookie.name.startsWith('sb-') || cookie.name.includes('supabase')) {
      response.cookies.delete(cookie.name)
    }
  })
  
  return response
}

