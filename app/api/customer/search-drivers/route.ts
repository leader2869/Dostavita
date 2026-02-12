import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { search } = body

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
        { error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    // Ищем водителей, которые не привязаны к организации
    let query = supabase
      .from('profiles')
      .select('id, email, full_name, phone, vehicle_type, vehicle_number, license_number, avatar_url, organization_id')
      .eq('role', 'driver')
      .is('organization_id', null)
      .limit(20)

    // Если есть поисковый запрос, ищем по email, имени или телефону
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.or(`email.ilike.${searchTerm},full_name.ilike.${searchTerm},phone.ilike.${searchTerm}`)
    }

    const { data: drivers, error: driversError } = await query

    if (driversError) {
      console.error('Ошибка поиска водителей:', driversError)
      return NextResponse.json(
        { error: driversError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ drivers: drivers || [] })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

