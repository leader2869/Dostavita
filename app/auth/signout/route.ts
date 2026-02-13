import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  await supabase.auth.signOut()
  
  // Получаем базовый URL из заголовков запроса
  const origin = request.headers.get('origin') || request.nextUrl.origin
  return NextResponse.redirect(new URL('/login', origin))
}

