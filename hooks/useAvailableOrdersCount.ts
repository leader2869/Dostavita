'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAvailableOrdersCount(driverUserId: string | null) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!driverUserId) {
      setCount(0)
      setLoading(false)
      return
    }

    let isMounted = true

    const loadCount = async () => {
      try {
        // Получаем отказы водителя
        const { data: rejections } = await supabase
          .from('order_rejections')
          .select('order_id')
          .eq('driver_user_id', driverUserId)

        const rejectedOrderIds = new Set(rejections?.map(r => r.order_id) || [])

        // Получаем доступные заказы (исключая отказы)
        let query = supabase
          .from('orders')
          .select('id', { count: 'exact' })
          .eq('status', 'searching_courier')

        // Если есть отказы, исключаем их
        if (rejectedOrderIds.size > 0) {
          query = query.not('id', 'in', `(${Array.from(rejectedOrderIds).join(',')})`)
        }

        const { data: orders, error } = await query

        if (isMounted) {
          if (error) {
            console.error('Ошибка загрузки количества заказов:', error)
            setCount(0)
          } else {
            setCount(orders?.length || 0)
          }
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Ошибка загрузки количества заказов:', err)
          setCount(0)
          setLoading(false)
        }
      }
    }

    loadCount()

    // Подписываемся на изменения заказов через Realtime
    const channel = supabase
      .channel(`available-orders-count-${driverUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `status=eq.searching_courier`,
        },
        () => {
          // Перезагружаем количество при изменении заказов
          if (isMounted) {
            loadCount()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_rejections',
          filter: `driver_user_id=eq.${driverUserId}`,
        },
        () => {
          // Перезагружаем количество при изменении отказов
          if (isMounted) {
            loadCount()
          }
        }
      )
      .subscribe()

    // Обновляем каждые 30 секунд
    const interval = setInterval(() => {
      if (isMounted) {
        loadCount()
      }
    }, 30000)

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverUserId]) // supabase - стабильный объект, не нужно включать в зависимости

  return { count, loading }
}

