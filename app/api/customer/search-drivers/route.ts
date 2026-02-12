import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { search } = body

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      )
    }

    // Проверяем, что пользователь - организация
    const { data: profile } = await supabase
      .rpc('get_user_profile', { user_id: user.id })
      .single()

    if (!profile || (profile as any).role !== 'customer') {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    // Ищем водителей через RPC функцию (обходит RLS)
    const { data: drivers, error: driversError } = await supabase
      .rpc('search_available_drivers', { 
        search_term: search && search.trim() ? search.trim() : null 
      })

    if (driversError) {
      console.error('Ошибка поиска водителей:', driversError)
      return NextResponse.json(
        { error: driversError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ drivers: drivers || [] })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

