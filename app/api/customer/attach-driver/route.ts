import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { attachDriverSchema } from '@/lib/api/validate'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const bodyResult = await parseBody(request, attachDriverSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { driver_user_id, message } = bodyResult.data

    const auth = await requireRole(supabase, 'customer')
    if (!auth.ok) return auth.response
    const { user } = auth

    // Создаем запрос на привязку через RPC функцию
    const { data: requestId, error: requestError } = await supabase
      .rpc('create_driver_organization_request', {
        driver_user_id,
        organization_user_id: user.id,
        request_message: message || null,
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

