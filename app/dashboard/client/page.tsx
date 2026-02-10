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

      // Получаем заказы, где пользователь указан как получатель
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .or(`customer_id.eq.${user.id},client_id.eq.${user.id}`)
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

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-6 text-white">Главная</h1>

      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Мои заказы</h2>
        {loading ? (
          <p className="text-gray-400">Загрузка...</p>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <div key={order.id} className="border border-gray-700 rounded-lg p-4 bg-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">Заказ #{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-gray-300">
                      {order.pickup_address} → {order.delivery_address}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Статус: {getStatusLabel(order.status)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">{order.final_price} BYN</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">У вас пока нет заказов</p>
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
