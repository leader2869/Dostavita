'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Order {
  id: string
  order_number?: number | null
  pickup_address: string
  delivery_address: string
  final_price: number
  item_type: 'documents' | 'parcel' | 'flowers' | 'food' | 'other' | null
  description: string | null
  created_at: string
}

interface AvailableOrdersListProps {
  orders: Order[]
  driverUserId: string
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

export function AvailableOrdersList({ orders: initialOrders, driverUserId }: AvailableOrdersListProps) {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState(initialOrders)
  const [rejecting, setRejecting] = useState<string | null>(null)

  const handleReject = async (orderId: string) => {
    setRejecting(orderId)
    
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
        alert(data.error || 'Ошибка при отклонении заказа')
        setRejecting(null)
        return
      }

      // Удаляем заказ из списка
      setOrders(orders.filter(order => order.id !== orderId))
    } catch (error: any) {
      console.error('Ошибка при отклонении заказа:', error)
      alert('Ошибка при отклонении заказа')
    } finally {
      setRejecting(null)
    }
  }

  if (orders.length === 0) {
    return <p className="text-gray-400">Нет доступных заказов</p>
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="border border-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <p className="font-medium text-white">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
              <p className="text-sm text-gray-300 mt-1">
                {order.pickup_address} → {order.delivery_address}
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
            <a
              href={`/dashboard/driver/accept-order/${order.id}`}
              className="flex-1 text-center bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
            >
              Принять заказ
            </a>
            <button
              onClick={() => handleReject(order.id)}
              disabled={rejecting === order.id}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rejecting === order.id ? 'Отклонение...' : 'Отказаться'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

