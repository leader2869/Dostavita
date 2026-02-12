import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { driver_user_id } = body

    if (!driver_user_id) {
      return NextResponse.json(
        { error: 'ID водителя обязателен' },
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

    // Проверяем, что пользователь - организация
    const { data: profile } = await supabase
      .rpc('get_user_profile', { user_id: user.id })
      .single()

    if (!profile || profile.role !== 'customer') {
      return NextResponse.json(
        { error: 'Доступ запрещен. Только организации могут привязывать водителей' },
        { status: 403 }
      )
    }

    // Проверяем, что водитель существует и имеет роль driver
    const { data: driverProfile, error: driverError } = await supabase
      .from('profiles')
      .select('id, role, organization_id')
      .eq('id', driver_user_id)
      .single()

    if (driverError || !driverProfile) {
      return NextResponse.json(
        { error: 'Водитель не найден' },
        { status: 404 }
      )
    }

    if (driverProfile.role !== 'driver') {
      return NextResponse.json(
        { error: 'Пользователь не является водителем' },
        { status: 400 }
      )
    }

    if (driverProfile.organization_id === user.id) {
      return NextResponse.json(
        { error: 'Водитель уже привязан к вашей организации' },
        { status: 400 }
      )
    }

    if (driverProfile.organization_id) {
      return NextResponse.json(
        { error: 'Водитель уже привязан к другой организации' },
        { status: 400 }
      )
    }

    // Привязываем водителя к организации
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ organization_id: user.id })
      .eq('id', driver_user_id)
      .select()
      .single()

    if (updateError) {
      console.error('Ошибка привязки водителя:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      driver: updatedProfile,
      message: 'Водитель успешно привязан к организации'
    })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

