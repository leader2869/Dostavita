'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'

export default function ClientDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Получаем только активные заказы (не completed и не cancelled)
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .or(`customer_id.eq.${user.id},client_id.eq.${user.id}`)
        .not('status', 'in', '(completed,cancelled)')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Ошибка загрузки заказов:', error)
      } else {
        setOrders(ordersData || [])
      }
      
      setLoading(false)
    }

    loadData()
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'searching_courier':
        return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50'
      case 'courier_coming':
        return 'text-blue-400 bg-blue-400/20 border-blue-400/50'
      case 'courier_delivering':
        return 'text-purple-400 bg-purple-400/20 border-purple-400/50'
      case 'completed':
        return 'text-green-400 bg-green-400/20 border-green-400/50'
      case 'cancelled':
        return 'text-red-400 bg-red-400/20 border-red-400/50'
      default:
        return 'text-gray-400 bg-gray-400/20 border-gray-400/50'
    }
  }

  const shouldBlink = (status: string) => {
    // Мигают только активные статусы
    return status === 'searching_courier' || status === 'courier_coming' || status === 'courier_delivering'
  }

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-6 text-white">Главная</h1>

      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Мои активные заказы</h2>
        {loading ? (
          <p className="text-gray-400">Загрузка...</p>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <div
                key={order.id}
                className="border border-gray-700 rounded-lg p-4 bg-gray-700 hover:bg-gray-600 transition cursor-pointer"
                onClick={() => router.push(`/dashboard/client/orders/${order.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">Заказ #{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-gray-300">
                      {order.pickup_address} → {order.delivery_address}
                    </p>
                    <div className="mt-1">
                      <span className="text-sm text-gray-400">Статус: </span>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                          getStatusColor(order.status)
                        } ${shouldBlink(order.status) ? 'animate-blink' : ''}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">{order.final_price} BYN</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">У вас пока нет активных заказов</p>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Быстрые действия</h2>
        <div className="grid grid-cols-2 gap-4">
          <a
            href="/dashboard/client/create-order"
            className="bg-green-600 text-white p-4 rounded-lg text-center hover:bg-green-700 transition"
          >
            Создать заказ
          </a>
          <a
            href="/dashboard/client/orders"
            className="bg-gray-700 text-gray-300 p-4 rounded-lg text-center hover:bg-gray-600 transition"
          >
            Все заказы
          </a>
        </div>
      </div>

      <ClientBottomNavigation />
    </div>
  )
}
