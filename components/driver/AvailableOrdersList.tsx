'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'

interface Order {
  id: string
  order_number?: number | null
  pickup_address: string
  delivery_address: string
  final_price: number
  item_type: 'documents' | 'parcel' | 'flowers' | 'food' | 'other' | null
  description: string | null
  created_at: string
  cancelled_at?: string | null
  status?: string
}

interface AvailableOrdersListProps {
  orders: Order[]
  driverUserId: string
  cancelledOrders?: Order[]
}

const getItemTypeLabel = (itemType: string | null): string => {
  switch (itemType) {
    case 'documents':
      return 'Документы'
    case 'parcel':
      return 'Посылка'
    case 'flowers':
      return 'Цветы'
    case 'food':
      return 'Еда'
    case 'other':
      return 'Другое'
    default:
      return 'Не указан'
  }
}

export function AvailableOrdersList({ orders: initialOrders, driverUserId, cancelledOrders = [] }: AvailableOrdersListProps) {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState(initialOrders)
  const [rejectedOrderIds, setRejectedOrderIds] = useState<Set<string>>(new Set())
  const [showCancelled, setShowCancelled] = useState(false)
  // Используем ref для отслеживания отклоненных заказов, которые не должны возвращаться
  const rejectedOrderIdsRef = useRef<Set<string>>(new Set())

  // Синхронизируем локальное состояние с пропсами при обновлении
  // НО исключаем заказы, от которых водитель отказался
  useEffect(() => {
    // Фильтруем заказы, исключая те, от которых водитель отказался
    // Используем и состояние, и ref для надежности
    const allRejectedIds = new Set([...rejectedOrderIds, ...rejectedOrderIdsRef.current])
    const filtered = initialOrders.filter(order => !allRejectedIds.has(order.id))
    setOrders(filtered)
  }, [initialOrders, rejectedOrderIds])

  // Загружаем отказы водителя при монтировании
  useEffect(() => {
    const loadRejections = async () => {
      try {
        const { data: rejections } = await supabase
          .from('order_rejections')
          .select('order_id')
          .eq('driver_user_id', driverUserId)

        if (rejections) {
          const rejectedIds = new Set(rejections.map(r => r.order_id))
          setRejectedOrderIds(rejectedIds)
          rejectedOrderIdsRef.current = rejectedIds
        }
      } catch (error) {
        console.error('Ошибка загрузки отказов:', error)
      }
    }

    loadRejections()
  }, [driverUserId, supabase])

  const handleReject = async (orderId: string) => {
    // Добавляем заказ в список отказов для немедленного скрытия
    const newRejectedIds = new Set([...rejectedOrderIds, orderId])
    setRejectedOrderIds(newRejectedIds)
    rejectedOrderIdsRef.current = newRejectedIds
    
    // Сохраняем отказ в БД в фоне (для сохранения после перезагрузки)
    try {
      const response = await fetch('/api/driver/reject-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Ошибка сохранения отказа:', data.error || 'Неизвестная ошибка')
        // Если ошибка, убираем из списка отказов (заказ вернется)
        const updatedRejectedIds = new Set(rejectedOrderIds)
        updatedRejectedIds.delete(orderId)
        setRejectedOrderIds(updatedRejectedIds)
        rejectedOrderIdsRef.current = updatedRejectedIds
      } else {
        console.log('Отказ успешно сохранен:', orderId)
        // Подтверждаем, что отказ сохранен - обновляем ref
        rejectedOrderIdsRef.current = new Set([...rejectedOrderIdsRef.current, orderId])
      }
    } catch (error) {
      console.error('Ошибка сохранения отказа:', error)
      // Если ошибка, убираем из списка отказов (заказ вернется)
      const updatedRejectedIds = new Set(rejectedOrderIds)
      updatedRejectedIds.delete(orderId)
      setRejectedOrderIds(updatedRejectedIds)
      rejectedOrderIdsRef.current = updatedRejectedIds
    }
  }

  // Фильтруем отмененные заказы, исключая те, от которых водитель отказался
  const filteredCancelledOrders = showCancelled 
    ? cancelledOrders.filter(order => !rejectedOrderIdsRef.current.has(order.id))
    : []

  const allOrdersToShow = showCancelled 
    ? [...orders, ...filteredCancelledOrders]
    : orders

  if (allOrdersToShow.length === 0 && !showCancelled) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-400">Нет доступных заказов</p>
          {cancelledOrders.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
                className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-300">Показать отмененные ({cancelledOrders.length})</span>
            </label>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Переключатель для показа отмененных заказов - показываем всегда */}
      <div className="flex items-center justify-end mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
            disabled={!cancelledOrders || cancelledOrders.length === 0}
            className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className={`text-sm ${cancelledOrders && cancelledOrders.length > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
            Показать отмененные заказы ({cancelledOrders?.length || 0})
          </span>
        </label>
      </div>
      {allOrdersToShow.map((order) => {
        // Проверяем, является ли заказ отмененным (находится в списке cancelledOrders)
        const isCancelled = cancelledOrders.some(co => co.id === order.id)
        return (
        <div key={order.id} className={`border rounded-lg p-4 ${isCancelled ? 'border-red-600 bg-red-900/20' : 'border-gray-700'}`}>
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-white">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                {isCancelled && (
                  <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
                    Отменен
                  </span>
                )}
                {!isCancelled && order.cancelled_at && (
                  <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
                    Был отменен
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-300 mt-1">
                а) {formatAddressForOrder(order.pickup_address)}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                б) {formatAddressForOrder(order.delivery_address)}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Тип груза: <span className="text-gray-300">{getItemTypeLabel(order.item_type)}</span>
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Создан: <span className="text-gray-300">
                  {new Date(order.created_at).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                {' • '}
                <span className="text-purple-400 font-medium animate-blink">
                  {formatDistanceToNow(new Date(order.created_at), {
                    addSuffix: true,
                    locale: ru
                  })}
                </span>
              </p>
              {order.description && (
                <p className="text-sm text-gray-400 mt-2 italic">
                  {order.description}
                </p>
              )}
            </div>
            <p className="font-semibold text-white ml-4">{order.final_price} BYN</p>
          </div>
          <div className="flex gap-2 mt-3">
            {isCancelled ? (
              <a
                href={`/dashboard/driver/accept-order/${order.id}?reactivate=true`}
                className="flex-1 text-center bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700 transition"
              >
                Активировать заказ
              </a>
            ) : (
              <>
                <a
                  href={`/dashboard/driver/accept-order/${order.id}`}
                  className="flex-1 text-center bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
                >
                  Принять заказ
                </a>
                <button
                  onClick={() => handleReject(order.id)}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition"
                >
                  Отказаться
                </button>
              </>
            )}
          </div>
        </div>
      )
      })}
    </div>
  )
}

