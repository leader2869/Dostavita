import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { updateLocationSchema } from '@/lib/api/validate'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const bodyResult = await parseBody(request, updateLocationSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { latitude, longitude, accuracy, heading, speed, order_id } = bodyResult.data

    const auth = await requireRole(supabase, 'driver')
    if (!auth.ok) return auth.response
    const { user } = auth

    // Сохраняем точку трека в driver_locations
    // Каждая запись - это точка трека водителя, сохраняемая каждую минуту
    // Это позволяет отслеживать маршрут движения водителя в течение дня
    const { data: locationData, error: locationError } = await supabase
      .from('driver_locations')
      .insert({
        driver_id: user.id,
        order_id: order_id ?? null,
        latitude: String(latitude),
        longitude: String(longitude),
        accuracy: accuracy ?? null,
        heading: heading ?? null,
        speed: speed ?? null,
      })
      .select()
      .single()

    if (locationError) {
      console.error('Ошибка сохранения местоположения:', locationError)
      return NextResponse.json(
        { error: locationError.message },
        { status: 500 }
      )
    }

    // Также обновляем current_location в profiles для быстрого доступа
    // Используем RPC функцию для обхода RLS
    const { error: updateProfileError } = await supabase.rpc('update_driver_location', {
      p_driver_id: user.id,
      p_longitude: Number(longitude),
      p_latitude: Number(latitude),
    })

    if (updateProfileError) {
      console.error('Ошибка обновления current_location в profiles:', updateProfileError)
      // Не возвращаем ошибку, так как основное сохранение в driver_locations прошло успешно
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

