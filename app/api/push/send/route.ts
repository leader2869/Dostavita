import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

// Настройка VAPID деталей
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:dostavita@example.com', // Контактный email (можно изменить)
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

interface SendPushNotificationRequest {
  userId: string
  title: string
  body: string
  data?: any
  tag?: string
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    // Проверяем, что пользователь - админ или суперадмин
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    const body: SendPushNotificationRequest = await request.json()
    const { userId, title, body: notificationBody, data, tag } = body

    if (!userId || !title || !notificationBody) {
      return NextResponse.json(
        { error: 'Необходимы userId, title и body' },
        { status: 400 }
      )
    }

    // Получаем все подписки пользователя
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key')
      .eq('user_id', userId)

    if (subsError) {
      console.error('Ошибка получения подписок:', subsError)
      return NextResponse.json({ error: 'Ошибка получения подписок' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'У пользователя нет активных подписок' },
        { status: 404 }
      )
    }

    // Отправляем уведомление на каждую подписку
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const subscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh_key,
              auth: sub.auth_key,
            },
          }

          const payload = JSON.stringify({
            title,
            body: notificationBody,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: tag || 'notification',
            data: data || {},
            requireInteraction: true,
            actions: [
              {
                action: 'view',
                title: 'Посмотреть',
              },
              {
                action: 'close',
                title: 'Закрыть',
              },
            ],
          })

          await webpush.sendNotification(subscription, payload)
          return { success: true, endpoint: sub.endpoint }
        } catch (error: any) {
          console.error('Ошибка отправки push-уведомления:', error)
          
          // Если подписка недействительна (410), удаляем её
          if (error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint)
            return { success: false, endpoint: sub.endpoint, error: 'Подписка удалена (недействительна)' }
          }
          
          return { success: false, endpoint: sub.endpoint, error: error.message }
        }
      })
    )

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length,
      results: results.map((r) => (r.status === 'fulfilled' ? r.value : { error: r.reason })),
    })
  } catch (error: any) {
    console.error('Ошибка отправки push-уведомления:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

