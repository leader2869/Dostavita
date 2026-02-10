'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'

export default function DriverMyOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      console.log('Driver My Orders - Loading orders for user:', user.id)

      // Получаем только выполняемые заказы водителя (где executor_user_id равен ID текущего пользователя)
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('executor_user_id', user.id)
        .in('status', ['courier_coming', 'courier_delivering'])
        .order('created_at', { ascending: false })

      console.log('Driver My Orders - Query result:')
      console.log('  - Orders count:', ordersData?.length || 0)
      console.log('  - Error:', error)
      if (ordersData && ordersData.length > 0) {
        console.log('  - Orders:', ordersData.map((o: any) => ({
          id: o.id?.slice(0, 8),
          status: o.status,
          executor_user_id: o.executor_user_id,
          created_at: o.created_at
        })))
      } else {
        console.log('  - No orders found')
      }

      if (error) {
        console.error('Ошибка загрузки заказов:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
      } else {
        setOrders(ordersData || [])
      }

      // Также проверяем все заказы с executor_user_id (без фильтра по статусу) для отладки
      const { data: allOrdersData, error: allOrdersError } = await supabase
        .from('orders')
        .select('id, executor_user_id, status, created_at')
        .eq('executor_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      console.log('Driver My Orders - All orders with executor_user_id:')
      console.log('  - Count:', allOrdersData?.length || 0)
      console.log('  - Error:', allOrdersError)
      if (allOrdersData && allOrdersData.length > 0) {
        console.log('  - Orders:', allOrdersData.map((o: any) => ({
          id: o.id?.slice(0, 8),
          status: o.status,
          executor_user_id: o.executor_user_id,
          created_at: o.created_at
        })))
      } else {
        console.log('  - No orders found with executor_user_id')
      }
      
      setLoading(false)
    }

    loadOrders()
  }, [supabase, router])

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'courier_coming':
        return 'Еду за посылкой'
      case 'courier_delivering':
        return 'Доставляю заказ'
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
      case 'courier_coming':
        return 'bg-yellow-600'
      case 'courier_delivering':
        return 'bg-blue-600'
      case 'completed':
        return 'bg-green-600'
      case 'cancelled':
        return 'bg-red-600'
      default:
        return 'bg-gray-600'
    }
  }

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Мои заказы</h1>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Загрузка...</div>
      ) : orders.length === 0 ? (
        <div className="bg-gray-800 rounded-lg shadow p-6 text-center">
          <p className="text-gray-400">У вас пока нет активных заказов</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700 hover:border-green-500 transition cursor-pointer"
              onClick={() => router.push(`/dashboard/driver/orders/${order.id}`)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      Заказ #{order.id.slice(0, 8)}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs text-white ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mb-1">
                    <span className="font-medium">Откуда:</span> {order.pickup_address}
                  </p>
                  <p className="text-sm text-gray-300 mb-1">
                    <span className="font-medium">Куда:</span> {order.delivery_address}
                  </p>
                  {order.item_type && (
                    <p className="text-sm text-gray-400 mt-2">
                      Тип груза: <span className="text-gray-300">
                        {order.item_type === 'documents' ? 'Документы' :
                         order.item_type === 'parcel' ? 'Посылка' :
                         order.item_type === 'flowers' ? 'Цветы' :
                         order.item_type === 'food' ? 'Еда' :
                         order.item_type === 'other' ? 'Другое' : 'Не указан'}
                      </span>
                    </p>
                  )}
                  {order.description && (
                    <p className="text-sm text-gray-400 mt-1 italic">
                      {order.description}
                    </p>
                  )}
                </div>
                <div className="text-right ml-4">
                  <p className="text-xl font-bold text-white mb-2">
                    {order.final_price} BYN
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/dashboard/driver/orders/${order.id}`)
                    }}
                    className="text-sm text-green-500 hover:text-green-400 underline"
                  >
                    Детали →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

