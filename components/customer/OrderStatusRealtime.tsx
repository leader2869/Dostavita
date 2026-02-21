'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OrderStatusRealtimeProps {
  orderId: string
  initialStatus: string
  hasRejections?: boolean
  rejectionsCount?: number
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'searching_courier':
      return 'Ищем курьера'
    case 'courier_accepted':
      return 'Курьер принял заказ'
    case 'courier_coming':
      return 'Курьер едет к отправителю'
    case 'courier_delivering':
      return 'Курьер едет к получателю'
    case 'completed':
      return 'Заказ завершен'
    case 'cancelled':
      return 'Отменен'
    default:
      return status
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'searching_courier':
      return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50'
    case 'courier_accepted':
      return 'text-orange-400 bg-orange-400/20 border-orange-400/50'
    case 'courier_coming':
      return 'text-blue-400 bg-blue-400/20 border-blue-400/50'
    case 'courier_delivering':
      return 'text-purple-400 bg-purple-400/20 border-purple-400/50'
    case 'completed':
      return 'text-brand-light bg-brand-light/20 border-green-400/50'
    case 'cancelled':
      return 'text-red-400 bg-red-400/20 border-red-400/50'
    default:
      return 'text-gray-600 bg-gray-400/20 border-gray-400/50'
  }
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

