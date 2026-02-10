import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'
import { AvailableOrdersList } from '@/components/driver/AvailableOrdersList'

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
    .select('id, pickup_address, delivery_address, final_price, item_type, description, created_at')
    .eq('status', 'searching_courier')
    .order('created_at', { ascending: false })
    .limit(10)

  // Получаем отказы водителя, чтобы исключить их из списка
  const { data: rejections } = await supabase
    .from('order_rejections')
    .select('order_id')
    .eq('driver_user_id', user.id)

  // Фильтруем заказы, исключая те, от которых водитель отказался
  const rejectedOrderIds = new Set(rejections?.map(r => r.order_id) || [])
  const filteredOrders = availableOrders?.filter(order => !rejectedOrderIds.has(order.id)) || []

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

  // Также проверяем заказы через driver_id (для обратной совместимости)
  const { data: ordersByDriverId, error: driverIdError } = await supabase
    .from('orders')
    .select('id, driver_id, executor_user_id, status')
    .not('driver_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)
  
  console.log('Driver Dashboard - Orders by driver_id (for debugging):', ordersByDriverId?.length || 0)

  // Фильтруем только активные заказы
  const { data: myOrders, error: myOrdersError } = await supabase
    .from('orders')
    .select('*')
    .eq('executor_user_id', user.id)
    .in('status', ['courier_coming', 'courier_delivering', 'searching_courier'])
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
    <div>
      <h1 className="text-3xl font-bold mb-6 text-white">Панель исполнителя</h1>
      
      {/* Навигация */}
      <div className="mb-6 flex gap-4">
        <a
          href="/dashboard/driver/profile"
          className="bg-gray-800 px-4 py-2 rounded-lg shadow hover:shadow-lg transition"
        >
          Профиль
        </a>
        <a
          href="/dashboard/driver/finance"
          className="bg-gray-800 px-4 py-2 rounded-lg shadow hover:shadow-lg transition"
        >
          Финансы
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Доступные заказы */}
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Доступные заказы</h2>
          <AvailableOrdersList orders={filteredOrders} driverUserId={user.id} />
        </div>

        {/* Мои заказы */}
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Мои заказы</h2>
          {myOrders && myOrders.length > 0 ? (
            <div className="space-y-4">
              {myOrders.map((order: any) => (
                <div key={order.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Заказ #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-300">
                        {order.pickup_address} → {order.delivery_address}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Статус: {order.status === 'courier_coming' ? 'Еду за посылкой' :
                                 order.status === 'courier_delivering' ? 'Доставляю заказ' :
                                 order.status === 'completed' ? 'Заказ завершен' : order.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{order.final_price} BYN</p>
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
            <p className="text-gray-400">У вас пока нет заказов</p>
          )}
        </div>
      </div>
    </div>
  )
}
