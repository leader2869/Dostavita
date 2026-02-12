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

      console.log('=== Driver My Orders - Loading orders ===')
      console.log('User ID:', user.id)

      // Сначала проверяем все заказы с executor_user_id (без фильтра по статусу) для отладки
      const { data: allOrdersData, error: allOrdersError } = await supabase
        .from('orders')
        .select('id, executor_user_id, status, created_at, accepted_at')
        .eq('executor_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      console.log('=== All orders with executor_user_id ===')
      console.log('Count:', allOrdersData?.length || 0)
      console.log('Error:', allOrdersError)
      if (allOrdersData && allOrdersData.length > 0) {
        allOrdersData.forEach((o: any, index: number) => {
          console.log(`Order ${index + 1}:`, {
            id: o.id?.slice(0, 8),
            status: o.status,
            executor_user_id: o.executor_user_id,
            created_at: o.created_at,
            accepted_at: o.accepted_at
          })
          console.log(`  Status is courier_coming? ${o.status === 'courier_coming'}`)
          console.log(`  Status is courier_delivering? ${o.status === 'courier_delivering'}`)
          console.log(`  Status in filter? ${['courier_coming', 'courier_delivering'].includes(o.status)}`)
        })
      } else {
        console.log('❌ No orders found with executor_user_id =', user.id)
        if (allOrdersError) {
          console.error('Error details:', JSON.stringify(allOrdersError, null, 2))
        }
      }

      // Получаем все заказы водителя (где executor_user_id равен ID текущего пользователя)
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('executor_user_id', user.id)
        .order('created_at', { ascending: false })

      console.log('=== Active orders query result ===')
      console.log('Orders count:', ordersData?.length || 0)
      console.log('Error:', error)
      if (ordersData && ordersData.length > 0) {
        console.log('Orders:', ordersData.map((o: any) => ({
          id: o.id?.slice(0, 8),
          status: o.status,
          executor_user_id: o.executor_user_id,
          created_at: o.created_at
        })))
      } else {
        console.log('❌ No active orders found (status: courier_coming or courier_delivering)')
        if (error) {
          console.error('Error details:', JSON.stringify(error, null, 2))
        }
      }

      if (error) {
        console.error('❌ Ошибка загрузки заказов:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        setOrders([])
      } else {
        setOrders(ordersData || [])
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
    return status === 'courier_coming' || status === 'courier_delivering'
  }

  // Разделяем заказы на активные и завершенные
  const activeOrders = orders.filter(order => 
    order.status !== 'completed' && order.status !== 'cancelled'
  )
  const completedOrders = orders.filter(order => 
    order.status === 'completed' || order.status === 'cancelled'
  )

  const renderOrderCard = (order: any) => {
    return (
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
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                  getStatusColor(order.status)
                } ${shouldBlink(order.status) ? 'animate-blink' : ''}`}
              >
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
    )
  }

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Мои заказы</h1>

      {loading ? (
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-400 text-center">Загрузка...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Активные заказы */}
          {activeOrders.length > 0 && (
            <div className="bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-white mb-4 pb-2 border-b border-gray-700">
                Активные заказы ({activeOrders.length})
              </h2>
              <div className="space-y-4">
                {activeOrders.map(renderOrderCard)}
              </div>
            </div>
          )}

          {/* История заказов */}
          {completedOrders.length > 0 && (
            <div className="bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-white mb-4 pb-2 border-b border-gray-700">
                История заказов ({completedOrders.length})
              </h2>
              <div className="space-y-4">
                {completedOrders.map(renderOrderCard)}
              </div>
            </div>
          )}

          {/* Если нет заказов вообще */}
          {orders.length === 0 && (
            <div className="bg-gray-800 rounded-lg shadow p-6">
              <p className="text-gray-400 text-center">У вас пока нет заказов</p>
            </div>
          )}
        </div>
      )}
      
      {/* Нижняя навигация */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex justify-around items-center h-16">
          <a
            href="/dashboard/driver"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Главная</span>
          </a>
          <a
            href="/dashboard/driver/my-orders"
            className="flex flex-col items-center justify-center flex-1 h-full text-green-400 hover:text-green-300 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Заказы</span>
          </a>
          <a
            href="/dashboard/driver/finance"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">Финансы</span>
          </a>
          <a
            href="/dashboard/driver/profile"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs">Профиль</span>
          </a>
        </div>
      </div>
    </div>
  )
}

