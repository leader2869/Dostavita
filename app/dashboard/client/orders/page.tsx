'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'

export default function ClientOrdersPage() {
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

      // Получаем все заказы, где пользователь является отправителем или получателем
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .or(`customer_id.eq.${user.id},client_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Ошибка загрузки заказов:', error)
      } else {
        setOrders(ordersData || [])
      }
      
      setLoading(false)
    }

    loadOrders()
  }, [supabase, router])

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'searching_courier':
        return 'Ищем курьера'
      case 'courier_coming':
        return 'Курьер едет к вам'
      case 'courier_delivering':
        return 'Курьер доставляет заказ'
      case 'completed':
        return 'Заказ завершен'
      case 'cancelled':
        return 'Отменен'
      default:
        return status
    }
  }

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-6 text-white">Мои заказы</h1>

      <div className="bg-gray-800 rounded-lg shadow p-6">
        {loading ? (
          <p className="text-gray-400">Загрузка...</p>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="border rounded-lg p-4 hover:shadow-md transition"
                onClick={() => router.push(`/dashboard/client/orders/${order.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">Заказ #{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-gray-300 mt-1">
                      {order.pickup_address} → {order.delivery_address}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Статус: {getStatusLabel(order.status)}
                    </p>
                    {order.description && (
                      <p className="text-sm text-gray-400 mt-1">
                        {order.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-lg">{order.final_price} BYN</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">У вас пока нет заказов</p>
        )}
      </div>

      <ClientBottomNavigation />
    </div>
  )
}

