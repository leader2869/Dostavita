import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { updateLocationSchema } from '@/lib/api/validate'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const bodyResult = await parseBody(request, updateLocationSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { latitude, longitude, accuracy, heading, speed, order_id } = bodyResult.data

    const auth = await requireRole(supabase, 'driver')
    if (!auth.ok) return auth.response
    const { user } = auth

    const { data: locationData, error } = await supabase.rpc('record_driver_location', {
      p_latitude: latitude, p_longitude: longitude,
      p_accuracy: accuracy ?? null, p_heading: heading ?? null,
      p_speed: speed ?? null, p_order_id: order_id ?? null,
    })
    if (error) {
      const status = error.code === '42501' ? 403 : error.code === '22023' ? 400 : 500
      return NextResponse.json({ error: status === 403 ? 'Нет доступа к этому заказу' :
        status === 400 ? 'Некорректная геопозиция' : 'Не удалось сохранить геопозицию' }, { status })
    }

    return NextResponse.json({
      success: true,
      location: locationData,
    })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

