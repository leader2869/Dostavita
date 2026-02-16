import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { full_name, phone, vehicle_type, vehicle_brand, vehicle_model, vehicle_number, license_number } = body

    if (!vehicle_type || !license_number || !phone) {
      return NextResponse.json(
        { error: 'Телефон, тип транспорта и номер лицензии обязательны' },
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

    // Обновляем профиль пользователя, добавляя информацию об автомобиле
    // Серверный клиент обходит RLS
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: full_name || null,
        phone: phone,
        vehicle_type,
        vehicle_brand: vehicle_brand || null,
        vehicle_model: vehicle_model || null,
        vehicle_number: vehicle_number || null,
        license_number,
      })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Ошибка обновления профиля водителя:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ profile: updatedProfile })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

