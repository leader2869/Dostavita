import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'

export default async function CustomerOrdersPage() {
  const supabase = createServerSupabaseClient()
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Проверяем роль
  const { data: profile } = await supabase
    .rpc('get_user_profile', { user_id: user.id })
    .single()

  if (!profile || (profile as any).role !== 'customer') {
    redirect('/dashboard')
  }

  // Получаем заказы водителей организации
  const { data: orders, error: ordersError } = await supabase
    .rpc('get_organization_orders', { organization_user_id: user.id })

  // Разделяем на активные и завершенные
  const activeOrders = orders?.filter((o: any) => 
    o.status !== 'completed' && o.status !== 'cancelled'
  ) || []
  const completedOrders = orders?.filter((o: any) => 
    o.status === 'completed' || o.status === 'cancelled'
  ) || []

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

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">История заказов</h1>

      <div className="space-y-6">
        {/* Активные заказы */}
        {activeOrders.length > 0 && (
          <div className="bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-white mb-4 pb-2 border-b border-gray-700">
              Активные заказы ({activeOrders.length})
            </h2>
            <div className="space-y-4">
              {activeOrders.map((order: any) => (
                <div key={order.id} className="border border-gray-700 rounded-lg p-4 bg-gray-700 hover:bg-gray-600 transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-white">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-300 mt-1">
                        а) {order.pickup_address}
                      </p>
                      <p className="text-sm text-gray-300 mt-1">
                        б) {order.delivery_address}
                      </p>
                      <div className="mt-2">
                        <span className="text-sm text-gray-400">Статус: </span>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                            getStatusColor(order.status)
                          }`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      {order.driver_full_name && (
                        <p className="text-sm text-gray-400 mt-2">
                          Водитель: <span className="text-gray-300">{order.driver_full_name}</span>
                          {order.driver_phone && (
                            <span className="text-gray-400 ml-2">({order.driver_phone})</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-white text-lg">{order.final_price} BYN</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(order.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
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
              {completedOrders.map((order: any) => (
                <div key={order.id} className="border border-gray-700 rounded-lg p-4 bg-gray-700 hover:bg-gray-600 transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-white">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-300 mt-1">
                        а) {order.pickup_address}
                      </p>
                      <p className="text-sm text-gray-300 mt-1">
                        б) {order.delivery_address}
                      </p>
                      <div className="mt-2">
                        <span className="text-sm text-gray-400">Статус: </span>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                            getStatusColor(order.status)
                          }`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      {order.driver_full_name && (
                        <p className="text-sm text-gray-400 mt-2">
                          Водитель: <span className="text-gray-300">{order.driver_full_name}</span>
                        </p>
                      )}
                      {order.completed_at && (
                        <p className="text-sm text-gray-400 mt-1">
                          Завершен: {new Date(order.completed_at).toLocaleString('ru-RU')}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-white text-lg">{order.final_price} BYN</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(order.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {orders?.length === 0 && (
          <div className="bg-gray-800 rounded-lg shadow p-6">
            <p className="text-gray-400 text-center">Пока нет заказов</p>
          </div>
        )}
      </div>

      {/* Нижняя навигация */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex justify-around items-center h-16">
          <a
            href="/dashboard/customer"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Главная</span>
          </a>
          <a
            href="/dashboard/customer/drivers"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs">Водители</span>
          </a>
          <a
            href="/dashboard/customer/orders"
            className="flex flex-col items-center justify-center flex-1 h-full text-green-400 hover:text-green-300 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Заказы</span>
          </a>
          <a
            href="/dashboard/customer/finance"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">Финансы</span>
          </a>
          <a
            href="/dashboard/customer/tracking"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">Отслеживание</span>
          </a>
        </div>
      </div>
    </div>
  )
}

