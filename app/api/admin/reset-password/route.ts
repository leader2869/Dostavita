import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * API endpoint для сброса пароля пользователя
 * Требует права суперадмина
 */
export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию и права суперадмина
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    // Проверяем, что пользователь - суперадмин
    const { data: profile } = await supabase
      .rpc('get_user_profile', { user_id: user.id })
      .single()

    if (!profile || (profile as any).role !== 'superadmin') {
      return NextResponse.json({ error: 'Доступ запрещен. Требуются права суперадмина.' }, { status: 403 })
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email не указан' }, { status: 400 })
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Ошибка: NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть установлены')
      return NextResponse.json({ error: 'Ошибка конфигурации сервера' }, { status: 500 })
    }

    // Создаем клиент с service role key для доступа к admin API
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Генерируем ссылку для сброса пароля
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    })

    if (error) {
      console.error('Ошибка при генерации ссылки для сброса пароля:', error)
      return NextResponse.json({ error: error.message || 'Ошибка при сбросе пароля' }, { status: 500 })
    }

    if (data?.properties?.action_link) {
      return NextResponse.json({
        success: true,
        resetLink: data.properties.action_link,
        message: 'Ссылка для сброса пароля успешно сгенерирована',
      })
    } else {
      return NextResponse.json({ error: 'Ссылка для сброса пароля не была сгенерирована' }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Ошибка в API reset-password:', error)
    return NextResponse.json({ error: error.message || 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

