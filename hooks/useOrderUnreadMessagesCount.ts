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
        // Получаем только непрочитанные сообщения от других пользователей
        const { data: messages, error: messagesError } = await supabase
          .from('order_messages')
          .select('id, sender_id, read_at')
          .eq('order_id', orderId)
          .neq('sender_id', userId) // Только сообщения не от текущего пользователя
          .is('read_at', null) // Только непрочитанные сообщения

        if (messagesError) {
          // CORS/сеть: не спамим консоль (настройте origin приложения в Supabase → Settings → API)
          if (process.env.NODE_ENV === 'development' && messagesError.message !== 'Load failed') {
            console.error('Ошибка загрузки сообщений для заказа:', messagesError)
          }
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
        // CORS/сеть (Load failed): не логируем каждый заказ — настройте Supabase CORS
        const isNetworkError = err instanceof TypeError && (err.message === 'Load failed' || err.message === 'Failed to fetch')
        if (process.env.NODE_ENV === 'development' && !isNetworkError) {
          console.error('Ошибка подсчета непрочитанных сообщений для заказа:', err)
        }
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

