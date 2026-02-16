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

        // Получаем все сообщения для активных заказов, отсортированные по времени
        const { data: messages, error: messagesError } = await supabase
          .from('order_messages')
          .select('id, order_id, sender_id, created_at')
          .in('order_id', orderIds)
          .order('created_at', { ascending: true })

        if (messagesError) {
          console.error('Ошибка загрузки сообщений:', messagesError)
          if (isMounted) {
            setCount(0)
            setLoading(false)
          }
          return
        }

        if (!messages || messages.length === 0) {
          if (isMounted) {
            setCount(0)
            setLoading(false)
          }
          return
        }

        // Группируем сообщения по заказам
        const messagesByOrder: Record<string, typeof messages> = {}
        messages.forEach(msg => {
          if (!messagesByOrder[msg.order_id]) {
            messagesByOrder[msg.order_id] = []
          }
          messagesByOrder[msg.order_id].push(msg)
        })

        // Для каждого заказа считаем непрочитанные сообщения
        // Непрочитанное = сообщение от другого пользователя, после которого нет ответа от текущего пользователя
        let unreadCount = 0

        Object.keys(messagesByOrder).forEach(orderId => {
          const orderMessages = messagesByOrder[orderId]
          
          // Находим последнее сообщение от текущего пользователя
          let lastUserMessageIndex = -1
          for (let i = orderMessages.length - 1; i >= 0; i--) {
            if (orderMessages[i].sender_id === userId) {
              lastUserMessageIndex = i
              break
            }
          }

          // Считаем сообщения от других пользователей, которые пришли после последнего сообщения пользователя
          if (lastUserMessageIndex === -1) {
            // Если пользователь еще не писал в этом заказе, все сообщения от других - непрочитанные
            unreadCount += orderMessages.filter(m => m.sender_id !== userId).length
          } else {
            // Считаем только сообщения после последнего сообщения пользователя
            for (let i = lastUserMessageIndex + 1; i < orderMessages.length; i++) {
              if (orderMessages[i].sender_id !== userId) {
                unreadCount++
              }
            }
          }
        })

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

