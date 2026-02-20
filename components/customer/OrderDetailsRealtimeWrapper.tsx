'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OrderDetailsRealtimeWrapperProps {
  initialOrder: any
  children: (order: any) => React.ReactNode
}

export function OrderDetailsRealtimeWrapper({ initialOrder, children }: OrderDetailsRealtimeWrapperProps) {
  const [order, setOrder] = useState(initialOrder)
  const supabase = createClient()

  // Подписка на изменения статуса заказа через Realtime
  useEffect(() => {
    if (!initialOrder?.id) return

    const channel = supabase
      .channel(`order_status_${initialOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${initialOrder.id}`,
        },
        (payload) => {
          const updatedOrder = payload.new as any
          // Обновляем статус заказа
          setOrder((prevOrder: any) => {
            if (prevOrder && prevOrder.id === updatedOrder.id) {
              return { ...prevOrder, ...updatedOrder }
            }
            return prevOrder
          })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [initialOrder?.id, supabase])

  // Обновляем локальное состояние при изменении initialOrder
  useEffect(() => {
    setOrder(initialOrder)
  }, [initialOrder])

  return <>{children(order)}</>
}


