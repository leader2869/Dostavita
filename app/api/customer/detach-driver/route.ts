import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { detachDriverSchema } from '@/lib/api/validate'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const bodyResult = await parseBody(request, detachDriverSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { driver_user_id } = bodyResult.data

    const auth = await requireRole(supabase, 'customer')
    if (!auth.ok) return auth.response
    const { user } = auth

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

