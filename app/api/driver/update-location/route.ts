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

    // Проверяем, что пользователь - водитель (используем простую функцию без рекурсии)
    const { data: isDriver, error: roleCheckError } = await supabase
      .rpc('check_driver_role', { p_user_id: user.id })

    if (roleCheckError || !isDriver) {
      console.error('Ошибка проверки роли водителя:', roleCheckError)
      return NextResponse.json(
        { error: 'Доступ запрещен. Только водители могут обновлять местоположение' },
        { status: 403 }
      )
    }

    // ВРЕМЕННО: Не обновляем profiles.current_location из-за рекурсии RLS
    // Используем только driver_locations для хранения местоположения
    // Это решает проблему рекурсии, так как driver_locations не имеет проблемных RLS политик
    // TODO: После исправления RLS политик можно вернуть обновление profiles

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

