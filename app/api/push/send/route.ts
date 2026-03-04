import { createServerSupabaseClient } from '@/lib/supabase/server'
import webpush from 'web-push'
import { apiError, apiSuccess, maskInternalMessage } from '@/lib/api/response'
import { requireRole } from '@/lib/api/auth'

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
    const auth = await requireRole(supabase, ['admin', 'superadmin'])
    if (!auth.ok) return auth.response

    const body: SendPushNotificationRequest = await request.json()
    const { userId, title, body: notificationBody, data, tag } = body

    if (!userId || !title || !notificationBody) {
      return apiError('Необходимы userId, title и body', 400)
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key')
      .eq('user_id', userId)

    if (subsError) {
      console.error('Ошибка получения подписок:', subsError)
      return apiError('Ошибка получения подписок', 500)
    }

    if (!subscriptions || subscriptions.length === 0) {
      return apiError('У пользователя нет активных подписок', 404)
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

    return apiSuccess({
      sent: successful,
      failed,
      total: subscriptions.length,
      results: results.map((r) => (r.status === 'fulfilled' ? r.value : { error: r.reason })),
    })
  } catch (error: any) {
    console.error('Ошибка отправки push-уведомления:', error)
    return apiError(maskInternalMessage(error?.message) || 'Внутренняя ошибка сервера', 500)
  }
}

