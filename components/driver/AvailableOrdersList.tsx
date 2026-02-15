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

  // Отладка: логируем cancelledOrders (скрытые заказы)
  useEffect(() => {
    console.log('AvailableOrdersList - cancelledOrders (скрытые заказы):', cancelledOrders)
    console.log('AvailableOrdersList - cancelledOrders length:', cancelledOrders?.length || 0)
    console.log('AvailableOrdersList - cancelledOrders is array:', Array.isArray(cancelledOrders))
    if (cancelledOrders && cancelledOrders.length > 0) {
      console.log('AvailableOrdersList - первый скрытый заказ:', cancelledOrders[0])
    }
  }, [cancelledOrders])

  // Синхронизируем локальное состояние с пропсами при обновлении
  // НО исключаем заказы, от которых водитель отказался
  useEffect(() => {
    let isMounted = true
    // Фильтруем заказы, исключая те, от которых водитель отказался
    // Используем и состояние, и ref для надежности
    const allRejectedIds = new Set([...rejectedOrderIds, ...rejectedOrderIdsRef.current])
    const filtered = initialOrders.filter(order => !allRejectedIds.has(order.id))
    
    if (isMounted) {
      setOrders(filtered)
    }
    
    return () => {
      isMounted = false
    }
  }, [initialOrders, rejectedOrderIds])

  // Загружаем отказы водителя при монтировании
  useEffect(() => {
    let isMounted = true
    
    const loadRejections = async () => {
      try {
        const { data: rejections } = await supabase
          .from('order_rejections')
          .select('order_id')
          .eq('driver_user_id', driverUserId)

        if (isMounted && rejections) {
          const rejectedIds = new Set(rejections.map(r => r.order_id))
          setRejectedOrderIds(rejectedIds)
          rejectedOrderIdsRef.current = rejectedIds
        }
      } catch (error) {
        if (isMounted) {
          console.error('Ошибка загрузки отказов:', error)
        }
      }
    }

    loadRejections()
    
    return () => {
      isMounted = false
    }
  }, [driverUserId]) // Убрали supabase из зависимостей, так как это стабильный объект

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
        setRejectedOrderIds(prev => {
          const updated = new Set(prev)
          updated.delete(orderId)
          rejectedOrderIdsRef.current = updated
          return updated
        })
      } else {
        console.log('Отказ успешно сохранен:', orderId)
        // Подтверждаем, что отказ сохранен - обновляем ref
        rejectedOrderIdsRef.current = new Set([...rejectedOrderIdsRef.current, orderId])
      }
    } catch (error) {
      console.error('Ошибка сохранения отказа:', error)
      // Если ошибка, убираем из списка отказов (заказ вернется)
      setRejectedOrderIds(prev => {
        const updated = new Set(prev)
        updated.delete(orderId)
        rejectedOrderIdsRef.current = updated
        return updated
      })
    }
  }

  // Скрытые заказы - это уже заказы из order_rejections, их не нужно фильтровать
  // Они должны показываться в отдельной секции под основным списком
  const hiddenOrders = showCancelled && cancelledOrders && cancelledOrders.length > 0
    ? cancelledOrders  // Не фильтруем, так как это уже отфильтрованные заказы (из order_rejections)
    : []

  console.log('AvailableOrdersList - showCancelled:', showCancelled)
  console.log('AvailableOrdersList - hiddenOrders:', hiddenOrders)
  console.log('AvailableOrdersList - orders count:', orders.length)

  if (orders.length === 0 && hiddenOrders.length === 0) {
    return (
      <div className="space-y-4">
        {/* Переключатель для показа скрытых заказов - показываем всегда */}
        <div className="flex items-center justify-start mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
              disabled={!cancelledOrders || cancelledOrders.length === 0}
              className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className={`text-sm ${cancelledOrders && cancelledOrders.length > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
              Показать скрытые ({cancelledOrders?.length || 0})
            </span>
          </label>
        </div>
        <p className="text-gray-400">Нет доступных заказов</p>
      </div>
    )
  }

  // Функция для отображения карточки заказа
  const renderOrderCard = (order: Order, isHidden: boolean = false) => (
    <div key={order.id} className={`border rounded-lg p-4 ${isHidden ? 'border-yellow-600 bg-yellow-900/20' : 'border-gray-700'}`}>
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-white">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                {isHidden && (
                  <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
                    Скрыт
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
            {isHidden ? (
              <a
                href={`/dashboard/driver/accept-order/${order.id}`}
                className="flex-1 text-center bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
              >
                Принять заказ
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
                  Скрыть заказ
                </button>
              </>
            )}
          </div>
        </div>
  )

  return (
    <div className="space-y-6">
      {/* Доступные заказы - без заголовка, так как он уже есть в родительском компоненте */}
      <div>
        <div className="flex items-center justify-start mb-4">
          {/* Переключатель для показа скрытых заказов */}
          {cancelledOrders && cancelledOrders.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
                className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
              />
              <span className="text-sm text-gray-300">
                Показать скрытые ({cancelledOrders.length})
              </span>
            </label>
          )}
        </div>
        {orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => renderOrderCard(order, false))}
          </div>
        ) : (
          <p className="text-gray-400">Нет доступных заказов</p>
        )}
      </div>

      {/* Скрытые заказы - показываем под доступными заказами */}
      {showCancelled && hiddenOrders.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Скрытые заказы</h3>
          <div className="space-y-4">
            {hiddenOrders.map((order) => renderOrderCard(order, true))}
          </div>
        </div>
      )}
    </div>
  )
}

