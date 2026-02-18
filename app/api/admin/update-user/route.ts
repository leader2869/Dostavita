import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()

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

    // Проверяем, что пользователь - суперадмин
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, fullName, phone, role, email } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'ID пользователя не указан' },
        { status: 400 }
      )
    }

    // Обновляем профиль
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        phone: phone || null,
        role: role || 'client',
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Ошибка обновления профиля:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Если изменился email, обновляем его в auth.users
    if (email) {
      const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
        email: email,
      })

      if (emailError) {
        console.error('Ошибка обновления email:', emailError)
        // Не возвращаем ошибку, так как профиль уже обновлен
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}




