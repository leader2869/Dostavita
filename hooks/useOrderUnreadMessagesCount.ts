'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useOrderUnreadMessagesCount(orderId: string, userId: string | null) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!orderId || !userId) {
      setCount(0)
      setLoading(false)
      return
    }

    let isMounted = true

    const loadUnreadCount = async () => {
      try {
        // Получаем все сообщения для этого заказа, отсортированные по времени
        const { data: messages, error: messagesError } = await supabase
          .from('order_messages')
          .select('id, sender_id, created_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })

        if (messagesError) {
          console.error('Ошибка загрузки сообщений для заказа:', messagesError)
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

        // Находим последнее сообщение от текущего пользователя
        let lastUserMessageIndex = -1
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].sender_id === userId) {
            lastUserMessageIndex = i
            break
          }
        }

        // Считаем непрочитанные сообщения
        let unreadCount = 0

        if (lastUserMessageIndex === -1) {
          // Если пользователь еще не писал в этом заказе, все сообщения от других - непрочитанные
          unreadCount = messages.filter(m => m.sender_id !== userId).length
        } else {
          // Считаем только сообщения после последнего сообщения пользователя
          for (let i = lastUserMessageIndex + 1; i < messages.length; i++) {
            if (messages[i].sender_id !== userId) {
              unreadCount++
            }
          }
        }

        if (isMounted) {
          setCount(unreadCount)
          setLoading(false)
        }
      } catch (err) {
        console.error('Ошибка подсчета непрочитанных сообщений для заказа:', err)
        if (isMounted) {
          setCount(0)
          setLoading(false)
        }
      }
    }

    loadUnreadCount()

    // Подписываемся на изменения сообщений через Realtime
    const channel = supabase
      .channel(`order-unread-messages-${orderId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_messages',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          // Перезагружаем количество при изменении сообщений
          if (isMounted) {
            loadUnreadCount()
          }
        }
      )
      .subscribe()

    // Обновляем каждые 3 секунды
    const interval = setInterval(() => {
      if (isMounted) {
        loadUnreadCount()
      }
    }, 3000)

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, userId])

  return { count, loading }
}

