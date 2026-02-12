import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { driver_user_id, message } = body

    if (!driver_user_id) {
      return NextResponse.json(
        { error: 'ID водителя обязателен' },
        { status: 400 }
      )
    }

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
        { error: 'Доступ запрещен. Только организации могут отправлять запросы водителям' },
        { status: 403 }
      )
    }

    // Создаем запрос на привязку через RPC функцию
    const { data: requestId, error: requestError } = await supabase
      .rpc('create_driver_organization_request', {
        p_driver_user_id: driver_user_id,
        p_organization_user_id: user.id,
        p_request_message: message || null,
      })

    if (requestError) {
      console.error('Ошибка создания запроса:', requestError)
      return NextResponse.json(
        { error: requestError.message || 'Ошибка создания запроса' },
        { status: 500 }
      )
    }

    if (!requestId) {
      return NextResponse.json(
        { error: 'Не удалось создать запрос. Возможно, водитель уже привязан или запрос уже существует.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      request_id: requestId,
      message: 'Запрос на привязку водителя успешно отправлен. Водитель получит уведомление.'
    })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

