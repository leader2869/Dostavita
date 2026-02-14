'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking'

/**
 * Компонент для автоматического отслеживания местоположения водителя
 * при наличии активных заказов
 */
export function DriverLocationTracker() {
  const supabase = createClient()
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [hasActiveOrders, setHasActiveOrders] = useState(false)

  // Отслеживаем местоположение, если есть активные заказы
  const { isTracking, error } = useDriverLocationTracking({
    enabled: hasActiveOrders,
    interval: 10000, // Обновляем каждые 10 секунд
    orderId: activeOrderId,
  })

  useEffect(() => {
    let channel: any = null
    let interval: NodeJS.Timeout | null = null

    const checkActiveOrders = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          console.error('Ошибка получения пользователя:', userError)
          return
        }
        
        if (!user) {
          console.log('Пользователь не авторизован')
          setHasActiveOrders(false)
          setActiveOrderId(null)
          return
        }

        // Проверяем наличие активных заказов
        const { data: activeOrders, error: ordersError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('executor_user_id', user.id)
          .in('status', ['courier_coming', 'courier_delivering'])
          .order('created_at', { ascending: false })
          .limit(1)

        if (ordersError) {
          console.error('Ошибка проверки активных заказов:', ordersError)
          return
        }

        const hasActive = (activeOrders?.length || 0) > 0
        setHasActiveOrders(hasActive)
        
        // Берем ID первого активного заказа
        if (hasActive && activeOrders && activeOrders.length > 0) {
          setActiveOrderId(activeOrders[0].id)
          console.log('Активные заказы найдены, начинаем отслеживание местоположения')
        } else {
          setActiveOrderId(null)
          console.log('Активных заказов нет, отслеживание местоположения отключено')
        }
      } catch (err) {
        console.error('Ошибка проверки активных заказов:', err)
      }
    }

    // Проверяем сразу
    checkActiveOrders()

    // Подписываемся на изменения заказов через Supabase Realtime
    // Используем правильный фильтр с получением user_id
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel(`driver-active-orders-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `executor_user_id=eq.${user.id}`,
          },
          () => {
            // При изменении заказов проверяем снова
            console.log('Обнаружено изменение заказов, проверяем активные заказы')
            checkActiveOrders()
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Подписка на обновления заказов активна')
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('Ошибка подключения к Realtime (не критично, проверка выполняется каждые 30 секунд)')
          }
        })
    }

    setupRealtime()

    // Проверяем каждые 30 секунд на случай, если Realtime не сработал
    interval = setInterval(checkActiveOrders, 30000)

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [supabase])

  // Не рендерим ничего визуально, только отслеживаем местоположение
  // Можно добавить индикатор, если нужно
  if (error && hasActiveOrders) {
    return (
      <div className="fixed bottom-20 left-4 right-4 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm z-50">
        <p>⚠️ {error}</p>
      </div>
    )
  }

  return null
}

