import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const requestId = params.id

    if (!requestId) {
      return NextResponse.json(
        { error: 'ID запроса обязателен' },
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
        { error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    // Отменяем запрос через RPC функцию
    const { data: success, error: cancelError } = await supabase
      .rpc('cancel_organization_request', {
        request_id: requestId,
        organization_user_id: user.id,
      })

    if (cancelError) {
      console.error('Ошибка отмены запроса:', cancelError)
      return NextResponse.json(
        { error: cancelError.message },
        { status: 500 }
      )
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Не удалось отменить запрос. Возможно, он уже обработан или не существует.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Запрос успешно отменен',
    })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

