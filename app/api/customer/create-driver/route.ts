import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { createDriverSchema } from '@/lib/api/validate'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const bodyResult = await parseBody(request, createDriverSchema)
    if (!bodyResult.ok) return bodyResult.response

    const { email, password, full_name, phone, vehicle_type, vehicle_brand, vehicle_model, vehicle_number, license_number } = bodyResult.data

    const auth = await requireRole(supabase, 'customer')
    if (!auth.ok) return auth.response
    const { user } = auth

    // Создаем пользователя в auth через admin API
    // Для admin API нужен service role key
    let newUser: any = null
    let signUpError: any = null

    try {
      // Создаем admin клиент с service role key
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )

      const adminResult = await supabaseAdmin.auth.admin.createUser({
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
    // Используем admin клиент для обхода RLS политик
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Проверяем, существует ли уже профиль для этого пользователя
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', newUser.user.id)
      .single()

    let driverProfile: any
    let profileError: any

    if (existingProfile) {
      // Если профиль уже существует, обновляем его
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          email,
          full_name,
          phone: phone || null,
          role: 'driver',
          organization_id: user.id,
          organization_attached_at: new Date().toISOString(),
          vehicle_type,
          vehicle_brand: vehicle_brand || null,
          vehicle_model: vehicle_model || null,
          vehicle_number: vehicle_number || null,
          license_number,
        })
        .eq('id', newUser.user.id)
        .select()
        .single()
      
      driverProfile = updatedProfile
      profileError = updateError
    } else {
      // Если профиля нет, создаем новый
      const { data: insertedProfile, error: insertError } = await supabaseAdmin
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
          vehicle_brand: vehicle_brand || null,
          vehicle_model: vehicle_model || null,
          vehicle_number: vehicle_number || null,
          license_number,
        })
        .select()
        .single()
      
      driverProfile = insertedProfile
      profileError = insertError
    }

    if (profileError) {
      // Если ошибка создания профиля, пытаемся удалить созданного пользователя
      try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        )
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      } catch (deleteErr) {
        console.error('Ошибка удаления пользователя:', deleteErr)
      }
      console.error('Ошибка создания профиля водителя:', profileError)
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }

    // Создаем баланс для водителя (используем admin клиент)
    await supabaseAdmin
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

