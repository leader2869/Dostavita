import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const requestId = params.id
    const body = await request.json()
    const { response } = body // 'accepted' или 'rejected'

    if (!requestId || !response) {
      return NextResponse.json(
        { error: 'ID запроса и ответ обязательны' },
        { status: 400 }
      )
    }

    if (response !== 'accepted' && response !== 'rejected') {
      return NextResponse.json(
        { error: 'Ответ должен быть "accepted" или "rejected"' },
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

    // Проверяем, что пользователь - водитель
    const { data: profile } = await supabase
      .rpc('get_user_profile', { user_id: user.id })
      .single()

    if (!profile || (profile as any).role !== 'driver') {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    // Отвечаем на запрос через RPC функцию
    const { data: success, error: respondError } = await supabase
      .rpc('respond_to_organization_request', {
        request_id: requestId,
        driver_user_id: user.id,
        response,
      })

    if (respondError) {
      console.error('Ошибка ответа на запрос:', respondError)
      return NextResponse.json(
        { error: respondError.message },
        { status: 500 }
      )
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Не удалось обработать запрос. Возможно, он уже обработан или не существует.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: response === 'accepted' 
        ? 'Вы успешно приняли запрос и привязаны к организации'
        : 'Вы отклонили запрос',
    })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

