import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth'
import { paramsIdSchema } from '@/lib/api/validate'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const paramsResult = paramsIdSchema.safeParse(params)
    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'ID запроса обязателен' },
        { status: 400 }
      )
    }
    const requestId = paramsResult.data.id

    const auth = await requireRole(supabase, 'customer')
    if (!auth.ok) return auth.response
    const { user } = auth

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

