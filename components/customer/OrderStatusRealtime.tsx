'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getOrderStatusLabel, getOrderStatusColor } from '@/lib/utils/orderStatus'

interface OrderStatusRealtimeProps {
  orderId: string
  initialStatus: string
  hasRejections?: boolean
  rejectionsCount?: number
}

export function OrderStatusRealtime({ 
  orderId, 
  initialStatus, 
  hasRejections = false,
  rejectionsCount = 0
}: OrderStatusRealtimeProps) {
  const [status, setStatus] = useState(initialStatus)
  const supabase = createClient()

  // Подписка на изменения статуса заказа через Realtime
  useEffect(() => {
    if (!orderId) return

    let isMounted = true

    if (process.env.NODE_ENV === 'development') {
      console.log('[OrderStatusRealtime] Подписка на заказ:', orderId)
    }

    // Подписываемся на все изменения заказов (без фильтра для обхода возможных проблем с RLS)
    const channel = supabase
      .channel(`order_status_org_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const updatedOrder = payload.new as any
          // Проверяем, что это наш заказ
          if (updatedOrder.id === orderId && updatedOrder.status && isMounted) {
            setStatus(updatedOrder.status)
          }
        }
      )
      .subscribe((subStatus) => {
        if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
          if (process.env.NODE_ENV === 'development') {
            console.error('[OrderStatusRealtime] Ошибка подписки:', subStatus)
          }
        }
      })

    // Периодический опрос как fallback (каждые 3 секунды)
    const pollInterval = setInterval(async () => {
      if (!isMounted) return
      
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: orderData, error } = await supabase
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .single()

        if (!error && orderData && orderData.status !== status) {
          setStatus(orderData.status)
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error('[OrderStatusRealtime] Polling error:', err)
      }
    }, 3000)

    return () => {
      isMounted = false
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [orderId, supabase, status])

  // Обновляем статус при изменении initialStatus
  useEffect(() => {
    setStatus(initialStatus)
  }, [initialStatus])

  return (
    <div className="flex items-center gap-3">
      <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getOrderStatusColor(status)}`}>
        {getOrderStatusLabel(status)}
      </span>
      {hasRejections && (
        <span className="px-3 py-1 bg-red-500 text-gray-900 text-sm rounded">
          Есть отказы ({rejectionsCount})
        </span>
      )}
    </div>
  )
}

