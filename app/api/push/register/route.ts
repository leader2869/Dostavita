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
    // Проверяем, существует ли уже подписка для этого пользователя и endpoint
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('endpoint', subscription.endpoint)
      .maybeSingle()

    if (fetchError) {
      console.error('Ошибка получения существующей подписки:', fetchError)
      return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 })
    }

    if (existingSubscription) {
      // Если подписка уже существует, обновляем её
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSubscription.id)

      if (updateError) {
        console.error('Ошибка обновления push-подписки:', updateError)
        return NextResponse.json({ error: 'Ошибка обновления подписки' }, { status: 500 })
      }
    } else {
      // Если подписки нет, создаем новую
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
        })

      if (insertError) {
        console.error('Ошибка сохранения push-подписки:', insertError)
        return NextResponse.json({ error: 'Ошибка сохранения подписки' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Ошибка регистрации push-подписки:', error)
    return NextResponse.json({ error: error.message || 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

