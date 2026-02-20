'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OrderStatusRealtimeProps {
  orderId: string
  initialStatus: string
  getStatusLabel: (status: string) => string
  getStatusColor: (status: string) => string
  hasRejections?: boolean
  rejectionsCount?: number
}

export function OrderStatusRealtime({ 
  orderId, 
  initialStatus, 
  getStatusLabel, 
  getStatusColor,
  hasRejections = false,
  rejectionsCount = 0
}: OrderStatusRealtimeProps) {
  const [status, setStatus] = useState(initialStatus)
  const supabase = createClient()

  // Подписка на изменения статуса заказа через Realtime
  useEffect(() => {
    if (!orderId) return

    let isMounted = true

    console.log('🔔 [Организация] Подписываемся на изменения заказа:', orderId)

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
            console.log('📦 [Организация] Получено обновление заказа:', updatedOrder)
            console.log('✅ [Организация] Обновляем статус:', updatedOrder.status)
            setStatus(updatedOrder.status)
          }
        }
      )
      .subscribe((subStatus) => {
        console.log('📡 [Организация] Статус подписки Realtime:', subStatus)
        if (subStatus === 'SUBSCRIBED') {
          console.log('✅ [Организация] Успешно подписались на изменения заказа')
        } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
          console.error('❌ [Организация] Ошибка подписки Realtime:', subStatus)
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
          console.log('🔄 [Организация] Polling: статус изменился', orderData.status)
          setStatus(orderData.status)
        }
      } catch (err) {
        console.error('[Организация] Ошибка polling:', err)
      }
    }, 3000)

    return () => {
      isMounted = false
      clearInterval(pollInterval)
      console.log('🔕 [Организация] Отписываемся от изменений заказа')
      supabase.removeChannel(channel)
    }
  }, [orderId, supabase, status])

  // Обновляем статус при изменении initialStatus
  useEffect(() => {
    setStatus(initialStatus)
  }, [initialStatus])

  return (
    <div className="flex items-center gap-3">
      <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(status)}`}>
        {getStatusLabel(status)}
      </span>
      {hasRejections && (
        <span className="px-3 py-1 bg-red-500 text-gray-900 text-sm rounded">
          Есть отказы ({rejectionsCount})
        </span>
      )}
    </div>
  )
}

