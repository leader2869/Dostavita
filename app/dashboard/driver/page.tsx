import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'
import { AvailableOrdersList } from '@/components/driver/AvailableOrdersList'
import { DriverLocationTracker } from '@/components/driver/DriverLocationTracker'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'

// Отключаем кеширование, чтобы данные всегда были актуальными
export const dynamic = 'force-dynamic'

export default async function DriverDashboard() {
  const supabase = createServerSupabaseClient()
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Используем RPC функцию для получения профиля (обходит RLS)
  let { data: profile, error: profileError } = await supabase
    .rpc('get_user_profile', { user_id: user.id })
    .single()
  
  // Fallback на прямой запрос
  if (profileError || !profile) {
    const { data: directProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    
    if (directProfile) {
      profile = directProfile as User
    }
  }

  if (!profile || (profile as User).role !== 'driver') {
    redirect('/dashboard')
  }

  // Получаем доступные заказы (все заказы со статусом "ищем курьера")
  const { data: availableOrders } = await supabase
    .from('orders')
    .select('id, order_number, pickup_address, delivery_address, final_price, item_type, description, created_at')
    .eq('status', 'searching_courier')
    .order('created_at', { ascending: false })
    .limit(10)

  // Получаем отказы водителя, чтобы исключить их из списка
  const { data: rejections, error: rejectionsError } = await supabase
    .from('order_rejections')
    .select('order_id')
    .eq('driver_user_id', user.id)

  if (rejectionsError) {
    console.error('Ошибка загрузки отказов:', rejectionsError)
  }

  // Фильтруем заказы, исключая те, от которых водитель отказался
  const rejectedOrderIds = new Set(rejections?.map(r => r.order_id) || [])
  const filteredOrders = availableOrders?.filter(order => !rejectedOrderIds.has(order.id)) || []

  console.log('Driver Dashboard - Rejections count:', rejections?.length || 0)
  console.log('Driver Dashboard - Rejected order IDs:', Array.from(rejectedOrderIds))
  console.log('Driver Dashboard - Available orders before filter:', availableOrders?.length || 0)
  console.log('Driver Dashboard - Filtered orders after rejections:', filteredOrders?.length || 0)

  // Получаем активные заказы водителя (где executor_user_id равен ID текущего пользователя)
  // Пробуем сначала без фильтра по статусу, чтобы увидеть все заказы
  const { data: allMyOrders, error: allOrdersError } = await supabase
    .from('orders')
    .select('id, executor_user_id, status, created_at, customer_id, client_id')
    .eq('executor_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  console.log('Driver Dashboard - User ID:', user.id)
  console.log('Driver Dashboard - All My Orders (no status filter):', allMyOrders?.length || 0, allMyOrders)
  if (allOrdersError) {
    console.error('Ошибка загрузки всех заказов водителя:', allOrdersError)
  }

  // Проверяем все заказы с executor_user_id (без фильтра по статусу) для отладки
  const { data: allOrdersDebug, error: debugError } = await supabase
    .from('orders')
    .select('id, executor_user_id, status, created_at')
    .eq('executor_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)
  
  console.log('Driver Dashboard - All orders with executor_user_id (for debugging):', allOrdersDebug?.length || 0)

  // Фильтруем только активные заказы, которые водитель выполняет
  // Статусы: courier_coming (едет за посылкой) и courier_delivering (доставляет заказ)
  // НЕ включаем searching_courier - это статус для доступных заказов, а не для выполняемых
  const { data: myOrders, error: myOrdersError } = await supabase
    .from('orders')
    .select('*')
    .eq('executor_user_id', user.id)
    .in('status', ['courier_coming', 'courier_delivering'])
    .order('created_at', { ascending: false })
    .limit(10)

  // Логирование для отладки
  if (myOrdersError) {
    console.error('Ошибка загрузки активных заказов водителя:', myOrdersError)
  }
  console.log('Driver Dashboard - User ID:', user.id)
  console.log('Driver Dashboard - Active Orders count:', myOrders?.length || 0)
  console.log('Driver Dashboard - Active Orders:', myOrders?.map((o: any) => ({
    id: o.id?.slice(0, 8),
    status: o.status,
    executor_user_id: o.executor_user_id,
    created_at: o.created_at
  })))

  return (
    <>
      <DriverLocationTracker />
      <div className="pb-20">
        <h1 className="text-3xl font-bold mb-6 text-white">Панель исполнителя</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Активные заказы - показываем первыми */}
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Активные заказы</h2>
          {myOrders && myOrders.length > 0 ? (
            <div className="space-y-4">
              {myOrders.map((order: any) => (
                <div key={order.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-300 mt-1">
                        а) {formatAddressForOrder(order.pickup_address)}
                      </p>
                      <p className="text-sm text-gray-300 mt-1">
                        б) {formatAddressForOrder(order.delivery_address)}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Статус: {order.status === 'courier_coming' ? 'Еду за посылкой' :
                                 order.status === 'courier_delivering' ? 'Доставляю заказ' :
                                 order.status === 'completed' ? 'Заказ завершен' : order.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">{order.final_price} BYN</p>
                      <a
                        href={`/dashboard/driver/orders/${order.id}`}
                        className="text-sm text-green-500 hover:text-green-600"
                      >
                        Детали
                      </a>
                      <a
                        href="/dashboard/driver/my-orders"
                        className="text-sm text-green-500 hover:text-green-600 block mt-1"
                      >
                        Все мои заказы →
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">У вас пока нет активных заказов</p>
          )}
        </div>

        {/* Доступные заказы - показываем вторыми */}
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Доступные заказы</h2>
          <AvailableOrdersList orders={filteredOrders} driverUserId={user.id} />
        </div>
      </div>
      
      {/* Нижняя навигация */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex justify-around items-center h-16">
          <a
            href="/dashboard/driver"
            className="flex flex-col items-center justify-center flex-1 h-full text-green-400 hover:text-green-300 transition"
          >
            <svg
              className="w-6 h-6 mb-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span className="text-xs">Главная</span>
          </a>

          <a
            href="/dashboard/driver/my-orders"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg
              className="w-6 h-6 mb-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <span className="text-xs">Заказы</span>
          </a>

          <a
            href="/dashboard/driver/finance"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg
              className="w-6 h-6 mb-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs">Финансы</span>
          </a>

          <a
            href="/dashboard/driver/profile"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg
              className="w-6 h-6 mb-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-xs">Профиль</span>
          </a>
        </div>
      </div>
    </div>
    </>
  )
}
