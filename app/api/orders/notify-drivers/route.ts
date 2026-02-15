import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

// Настройка VAPID деталей
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:dostavita@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

/**
 * API endpoint для отправки push-уведомлений водителям о новом заказе
 * Вызывается автоматически при создании нового заказа
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, orderNumber, finalPrice } = body

    if (!orderId) {
      return NextResponse.json({ error: 'orderId обязателен' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Получаем информацию о заказе
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, final_price, status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
    }

    // Проверяем, что заказ в статусе "ищем курьера"
    if (order.status !== 'searching_courier') {
      return NextResponse.json(
        { error: 'Заказ не в статусе searching_courier' },
        { status: 400 }
      )
    }

    // Получаем всех водителей с активными push-подписками
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh_key, auth_key')
      .not('endpoint', 'is', null)

    if (subsError) {
      console.error('Ошибка получения подписок:', subsError)
      return NextResponse.json({ error: 'Ошибка получения подписок' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'Нет активных подписок' }, { status: 200 })
    }

    // Проверяем, какие водители не отказались от этого заказа
    const { data: rejections } = await supabase
      .from('order_rejections')
      .select('driver_user_id')
      .eq('order_id', orderId)

    const rejectedDriverIds = new Set(rejections?.map((r) => r.driver_user_id) || [])

    // Фильтруем подписки, исключая водителей, которые отказались от заказа
    const validSubscriptions = subscriptions.filter(
      (sub) => !rejectedDriverIds.has(sub.user_id)
    )

    if (validSubscriptions.length === 0) {
      return NextResponse.json({ message: 'Нет водителей для уведомления' }, { status: 200 })
    }

    // Отправляем уведомление каждому водителю
    const results = await Promise.allSettled(
      validSubscriptions.map(async (sub) => {
        try {
          const subscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh_key,
              auth: sub.auth_key,
            },
          }

          const payload = JSON.stringify({
            title: 'Новый заказ!',
            body: `Заказ №${order.order_number || order.id.slice(0, 8)} - ${order.final_price} BYN`,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: `order-${order.id}`,
            data: {
              orderId: order.id,
              url: '/dashboard/driver',
            },
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
          return { success: true, userId: sub.user_id }
        } catch (error: any) {
          console.error(`Ошибка отправки push-уведомления водителю ${sub.user_id}:`, error)

          // Если подписка недействительна (410), удаляем её
          if (error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint)
            return {
              success: false,
              userId: sub.user_id,
              error: 'Подписка удалена (недействительна)',
            }
          }

          return { success: false, userId: sub.user_id, error: error.message }
        }
      })
    )

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
    const failed = results.length - successful

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: validSubscriptions.length,
    })
  } catch (error: any) {
    console.error('Ошибка отправки push-уведомлений водителям:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

