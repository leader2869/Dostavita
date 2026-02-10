import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { vehicle_type, vehicle_number, license_number } = body

    if (!vehicle_type || !license_number) {
      return NextResponse.json(
        { error: 'Тип транспорта и номер лицензии обязательны' },
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

    // Используем upsert для создания или обновления профиля водителя
    // Серверный клиент обходит RLS
    const { data: driver, error: upsertError } = await supabase
      .from('drivers')
      .upsert({
        user_id: user.id,
        vehicle_type,
        vehicle_number: vehicle_number || null,
        license_number,
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (upsertError) {
      console.error('Ошибка создания/обновления профиля водителя:', upsertError)
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ driver })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

