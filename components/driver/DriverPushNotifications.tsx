'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface DriverPushNotificationsProps {
  driverUserId: string
}

export function DriverPushNotifications({ driverUserId }: DriverPushNotificationsProps) {
  const supabase = createClient()
  const { isSupported, isSubscribed, subscribe } = usePushNotifications()

  useEffect(() => {
    if (!isSupported || isSubscribed) {
      return
    }

    // Автоматически подписываемся на push-уведомления
    const autoSubscribe = async () => {
      const success = await subscribe()
      if (success) {
        console.log('Автоматическая подписка на push-уведомления успешна')
      }
    }

    // Запрашиваем подписку через 2 секунды после монтирования
    const timer = setTimeout(autoSubscribe, 2000)
    return () => clearTimeout(timer)
  }, [isSupported, isSubscribed, subscribe])

  useEffect(() => {
    if (!driverUserId) return

    let isMounted = true

    // Подписываемся на новые заказы через Realtime
    const channel = supabase
      .channel(`new-orders-${driverUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `status=eq.searching_courier`,
        },
        async (payload) => {
          if (!isMounted) return

          const newOrder = payload.new as any

          // Проверяем, не отказался ли водитель от этого заказа
          const { data: rejection } = await supabase
            .from('order_rejections')
            .select('id')
            .eq('order_id', newOrder.id)
            .eq('driver_user_id', driverUserId)
            .maybeSingle()

          if (rejection) {
            // Водитель уже отказался от этого заказа, не показываем уведомление
            return
          }

          // Отправляем push-уведомление
          if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
              const registration = await navigator.serviceWorker.ready
              // Используем type assertion для actions, так как это не стандартный тип TypeScript
              await registration.showNotification('Новый заказ!', {
                body: `Заказ №${newOrder.order_number || newOrder.id.slice(0, 8)} - ${newOrder.final_price} BYN`,
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                tag: `order-${newOrder.id}`,
                data: {
                  orderId: newOrder.id,
                  url: `/dashboard/driver`,
                },
                requireInteraction: true,
                // @ts-ignore - actions поддерживается браузерами, но не в типах TypeScript
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
              } as NotificationOptions)
            } catch (error) {
              console.error('Ошибка отправки push-уведомления:', error)
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Подписка на новые заказы активна')
        }
      })

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverUserId]) // supabase - стабильный объект, не нужно включать в зависимости

  return null // Компонент не рендерит ничего визуально
}

