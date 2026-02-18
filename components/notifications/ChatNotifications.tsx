'use client'

import { createClient } from '@/lib/supabase/client'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ChatNotificationsProps {
  userId: string
  userRole?: string
}

export function ChatNotifications({ userId, userRole }: ChatNotificationsProps) {
  const { count } = useUnreadMessagesCount(userId)
  const router = useRouter()
  const supabase = createClient()
  const [hasActiveOrders, setHasActiveOrders] = useState(false)

  useEffect(() => {
    let isMounted = true

    const checkActiveOrders = async () => {
      try {
        // Делаем три отдельных запроса из-за RLS политик
        const activeStatuses = ['courier_accepted', 'courier_coming', 'courier_delivering']
        
        const [ordersAsCustomer, ordersAsClient, ordersAsDriver] = await Promise.all([
          supabase
            .from('orders')
            .select('id')
            .eq('customer_id', userId)
            .in('status', activeStatuses)
            .limit(1),
          supabase
            .from('orders')
            .select('id')
            .eq('client_id', userId)
            .in('status', activeStatuses)
            .limit(1),
          supabase
            .from('orders')
            .select('id')
            .eq('executor_user_id', userId)
            .in('status', activeStatuses)
            .limit(1)
        ])

        const hasOrders = 
          (ordersAsCustomer.data?.length || 0) > 0 ||
          (ordersAsClient.data?.length || 0) > 0 ||
          (ordersAsDriver.data?.length || 0) > 0

        if (isMounted) {
          setHasActiveOrders(hasOrders)
        }
      } catch (err) {
        console.error('Ошибка проверки активных заказов:', err)
        if (isMounted) {
          setHasActiveOrders(false)
        }
      }
    }

    checkActiveOrders()

    // Подписываемся на изменения заказов
    const channel = supabase
      .channel(`active-orders-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          if (isMounted) {
            checkActiveOrders()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Ошибки WebSocket не критичны - данные обновляются через polling
          console.warn('Realtime subscription error (не критично):', status)
        }
      })

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Если нет активных заказов или нет непрочитанных сообщений, не показываем иконку
  if (!hasActiveOrders || count === 0) {
    return null
  }

  const handleClick = () => {
    // Переходим на страницу заказов в зависимости от роли
    if (userRole === 'driver') {
      router.push('/dashboard/driver/my-orders')
    } else if (userRole === 'customer') {
      router.push('/dashboard/customer/orders')
    } else {
      router.push('/dashboard/client/orders')
    }
  }

  return (
    <button
      onClick={handleClick}
      className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      title={`Непрочитанных сообщений: ${count}`}
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      {count > 0 && (
        <span className={`absolute -top-1 -right-1 bg-red-500 text-gray-900 text-xs font-bold rounded-full flex items-center justify-center ${
          count > 9 ? 'px-1.5 min-w-[1.5rem]' : 'w-5 h-5'
        }`}>
          {count > 10 ? count : count >= 10 ? 10 : count}
        </span>
      )}
    </button>
  )
}

