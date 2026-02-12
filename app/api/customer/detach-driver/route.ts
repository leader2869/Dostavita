import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { driver_user_id } = body

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
        { error: 'Доступ запрещен. Только организации могут отвязывать водителей' },
        { status: 403 }
      )
    }

    // Отвязываем водителя от организации через RPC функцию (обходит RLS)
    const { data: success, error: updateError } = await supabase
      .rpc('update_driver_organization', {
        driver_user_id,
        organization_user_id: user.id,
        action: 'detach'
      })

    if (updateError) {
      console.error('Ошибка отвязки водителя:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Не удалось отвязать водителя. Возможно, он не привязан к вашей организации.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Водитель успешно отвязан от организации'
    })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
      )
  }
}

