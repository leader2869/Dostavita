import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient()

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

    // Получаем запросы организации через RPC функцию
    const { data: requests, error: requestsError } = await supabase
      .rpc('get_organization_requests', { organization_user_id: user.id })

    if (requestsError) {
      console.error('Ошибка получения запросов:', requestsError)
      return NextResponse.json(
        { error: requestsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ requests: requests || [] })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

