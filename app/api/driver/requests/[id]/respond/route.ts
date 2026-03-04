import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { paramsIdSchema, respondToRequestSchema } from '@/lib/api/validate'

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

    const bodyResult = await parseBody(request, respondToRequestSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { response } = bodyResult.data

    const auth = await requireRole(supabase, 'driver')
    if (!auth.ok) return auth.response
    const { user } = auth

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

