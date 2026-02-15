import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await request.json()
    const { subscription } = body

    if (!subscription) {
      return NextResponse.json({ error: 'Подписка не предоставлена' }, { status: 400 })
    }

    // Сохраняем подписку в базе данных
    // Создаем таблицу push_subscriptions если её нет
    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        subscription: subscription,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (insertError) {
      console.error('Ошибка сохранения push-подписки:', insertError)
      return NextResponse.json({ error: 'Ошибка сохранения подписки' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Ошибка регистрации push-подписки:', error)
    return NextResponse.json({ error: error.message || 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

