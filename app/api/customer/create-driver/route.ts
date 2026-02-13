import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()
    const { email, password, full_name, phone, vehicle_type, vehicle_number, license_number } = body

    if (!email || !password || !full_name || !vehicle_type || !license_number) {
      return NextResponse.json(
        { error: 'Email, пароль, имя, тип транспорта и номер удостоверения обязательны' },
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

    if (!profile || (profile as any).role !== 'customer') {
      return NextResponse.json(
        { error: 'Доступ запрещен. Только организации могут создавать аккаунты водителей' },
        { status: 403 }
      )
    }

    // Создаем пользователя в auth через admin API
    // Если admin API недоступен, используем обычный signUp
    let newUser: any = null
    let signUpError: any = null

    try {
      const adminResult = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Автоматически подтверждаем email
      })
      newUser = adminResult.data
      signUpError = adminResult.error
    } catch (err: any) {
      // Если admin API недоступен, возвращаем инструкцию
      console.error('Admin API недоступен:', err)
      return NextResponse.json(
        { 
          error: 'Создание пользователей через API недоступно. Пожалуйста, попросите водителя зарегистрироваться самостоятельно, а затем отправьте ему запрос на привязку.',
          requires_manual_registration: true
        },
        { status: 501 }
      )
    }

    if (signUpError || !newUser?.user) {
      console.error('Ошибка создания пользователя:', signUpError)
      return NextResponse.json(
        { error: signUpError?.message || 'Ошибка создания аккаунта' },
        { status: 500 }
      )
    }

    // Создаем профиль водителя и сразу привязываем к организации
    const { data: driverProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email,
        full_name,
        phone: phone || null,
        role: 'driver',
        organization_id: user.id,
        organization_attached_at: new Date().toISOString(),
        vehicle_type,
        vehicle_number: vehicle_number || null,
        license_number,
      })
      .select()
      .single()

    if (profileError) {
      // Если ошибка создания профиля, пытаемся удалить созданного пользователя
      try {
        await supabase.auth.admin.deleteUser(newUser.user.id)
      } catch (deleteErr) {
        console.error('Ошибка удаления пользователя:', deleteErr)
      }
      console.error('Ошибка создания профиля водителя:', profileError)
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }

    // Создаем баланс для водителя
    await supabase
      .from('balances')
      .insert({
        user_id: newUser.user.id,
        amount: 0,
        currency: 'BYN',
      })

    return NextResponse.json({
      success: true,
      driver: driverProfile,
      message: 'Аккаунт водителя успешно создан и привязан к организации',
    })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

