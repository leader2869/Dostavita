'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useUnreadMessagesCount(userId: string | null) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) {
      setCount(0)
      setLoading(false)
      return
    }

    let isMounted = true

    const loadUnreadCount = async () => {
      try {
        // Получаем только активные заказы пользователя (где он заказчик или водитель)
        // Исключаем завершенные заказы
        // Делаем три отдельных запроса из-за RLS политик
        const activeStatuses = ['courier_accepted', 'courier_coming', 'courier_delivering']
        
        const [ordersAsCustomer, ordersAsClient, ordersAsDriver] = await Promise.all([
          // Заказы где пользователь - заказчик (customer)
          supabase
            .from('orders')
            .select('id')
            .eq('customer_id', userId)
            .in('status', activeStatuses),
          // Заказы где пользователь - клиент (client)
          supabase
            .from('orders')
            .select('id')
            .eq('client_id', userId)
            .in('status', activeStatuses),
          // Заказы где пользователь - водитель (executor)
          supabase
            .from('orders')
            .select('id')
            .eq('executor_user_id', userId)
            .in('status', activeStatuses)
        ])

        // Объединяем результаты и убираем дубликаты
        const allOrderIds = new Set<string>()
        
        ordersAsCustomer.data?.forEach(o => allOrderIds.add(o.id))
        ordersAsClient.data?.forEach(o => allOrderIds.add(o.id))
        ordersAsDriver.data?.forEach(o => allOrderIds.add(o.id))

        if (allOrderIds.size === 0) {
          if (isMounted) {
            setCount(0)
            setLoading(false)
          }
          return
        }

        const orderIds = Array.from(allOrderIds)

        // Получаем только непрочитанные сообщения от других пользователей в активных заказах
        const { data: messages, error: messagesError } = await supabase
          .from('order_messages')
          .select('id')
          .in('order_id', orderIds)
          .neq('sender_id', userId) // Только сообщения не от текущего пользователя
          .is('read_at', null) // Только непрочитанные сообщения

        if (messagesError) {
          console.error('Ошибка загрузки сообщений:', messagesError)
          if (isMounted) {
            setCount(0)
            setLoading(false)
          }
          return
        }

        const unreadCount = messages?.length || 0

        if (isMounted) {
          setCount(unreadCount)
          setLoading(false)
        }
      } catch (err) {
        console.error('Ошибка подсчета непрочитанных сообщений:', err)
        if (isMounted) {
          setCount(0)
          setLoading(false)
        }
      }
    }

    loadUnreadCount()

    // Подписываемся на изменения сообщений через Realtime
    const channel = supabase
      .channel(`unread-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_messages',
        },
        () => {
          // Перезагружаем количество при изменении сообщений
          if (isMounted) {
            loadUnreadCount()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Ошибки WebSocket не критичны - данные обновляются через polling
          console.warn('Realtime subscription error (не критично):', status)
        }
      })

    // Обновляем каждые 5 секунд
    const interval = setInterval(() => {
      if (isMounted) {
        loadUnreadCount()
      }
    }, 5000)

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return { count, loading }
}

