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

    // Проверяем, что пользователь - водитель (используем RPC функцию для обхода RLS)
    const { data: profile, error: profileError } = await supabase
      .rpc('get_user_profile', { user_id: user.id })
      .single()

    if (profileError || !profile || (profile as any).role !== 'driver') {
      console.error('Ошибка проверки роли водителя:', profileError)
      return NextResponse.json(
        { error: 'Доступ запрещен. Только водители могут обновлять местоположение' },
        { status: 403 }
      )
    }

    // Обновляем текущее местоположение в profiles через прямой SQL запрос
    // Используем серверный клиент, который имеет больше прав
    // ВАЖНО: Не используем RPC функцию, если она вызывает рекурсию
    let profileUpdateSuccess = false
    try {
      // Пробуем обновить через прямой запрос (может не работать из-за RLS)
      const { error: directUpdateError } = await supabase
        .from('profiles')
        .update({
          current_location: `(${longitude},${latitude})`,
          location_updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (!directUpdateError) {
        profileUpdateSuccess = true
      } else {
        // Если прямой запрос не работает, пробуем RPC функцию
        console.warn('Прямое обновление не удалось, пробуем RPC функцию:', directUpdateError)
        const { data: updateResult, error: profileUpdateError } = await supabase
          .rpc('update_driver_location', {
            p_driver_id: user.id,
            p_longitude: longitude,
            p_latitude: latitude,
          })

        if (profileUpdateError) {
          console.error('Ошибка обновления местоположения в profiles через RPC:', profileUpdateError)
        } else if (updateResult) {
          profileUpdateSuccess = true
        }
      }
    } catch (err: any) {
      console.error('Исключение при обновлении местоположения в profiles:', err.message)
      // Не прерываем выполнение, так как запись в driver_locations все равно сохранится
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

