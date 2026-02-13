import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { latitude, longitude, accuracy, heading, speed, order_id } = body

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Широта и долгота обязательны' },
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
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'driver') {
      return NextResponse.json(
        { error: 'Доступ запрещен. Только водители могут обновлять местоположение' },
        { status: 403 }
      )
    }

    // Обновляем текущее местоположение в profiles
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        current_location: `(${longitude},${latitude})`,
        location_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (profileUpdateError) {
      console.error('Ошибка обновления местоположения в profiles:', profileUpdateError)
    }

    // Сохраняем запись в driver_locations
    const { data: locationData, error: locationError } = await supabase
      .from('driver_locations')
      .insert({
        driver_id: user.id,
        order_id: order_id || null,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        accuracy: accuracy || null,
        heading: heading || null,
        speed: speed || null,
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

