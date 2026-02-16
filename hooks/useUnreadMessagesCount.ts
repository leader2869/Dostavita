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
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id')
          .or(`customer_id.eq.${userId},client_id.eq.${userId},executor_user_id.eq.${userId}`)
          .in('status', ['courier_accepted', 'courier_coming', 'courier_delivering'])

        if (ordersError) {
          console.error('Ошибка загрузки заказов для подсчета сообщений:', ordersError)
          if (isMounted) {
            setCount(0)
            setLoading(false)
          }
          return
        }

        if (!orders || orders.length === 0) {
          if (isMounted) {
            setCount(0)
            setLoading(false)
          }
          return
        }

        const orderIds = orders.map(o => o.id)

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
      .subscribe()

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

