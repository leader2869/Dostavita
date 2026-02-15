import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'
import { AvailableOrdersList } from '@/components/driver/AvailableOrdersList'
import { DriverLocationTracker } from '@/components/driver/DriverLocationTracker'
import { DriverPushNotifications } from '@/components/driver/DriverPushNotifications'
import { DriverBottomNavigation } from '@/components/driver/DriverBottomNavigation'
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
  // Включаем заказы, которые были отменены, но сейчас снова активны (статус searching_courier)
  const { data: availableOrders } = await supabase
    .from('orders')
    .select('id, order_number, pickup_address, delivery_address, final_price, item_type, description, created_at, cancelled_at')
    .eq('status', 'searching_courier')
    .order('created_at', { ascending: false })
    .limit(10)

  // Получаем заказы, от которых водитель отказался (скрытые заказы)
  // Это заказы со статусом searching_courier, которые есть в order_rejections для этого водителя
  console.log('Driver Dashboard - Запрос скрытых заказов для user.id:', user.id)
  
  const { data: rejectedOrders, error: rejectedOrdersError } = await supabase
    .rpc('get_driver_rejected_orders', { p_driver_user_id: user.id })

  if (rejectedOrdersError) {
    console.error('Ошибка загрузки скрытых заказов:', rejectedOrdersError)
    console.error('Ошибка детали:', JSON.stringify(rejectedOrdersError, null, 2))
  }
  
  console.log('Driver Dashboard - User ID:', user.id)
  console.log('Driver Dashboard - Rejected orders (raw):', rejectedOrders)
  console.log('Driver Dashboard - Rejected orders count:', rejectedOrders?.length || 0)
  console.log('Driver Dashboard - Rejected orders is array:', Array.isArray(rejectedOrders))
  
  // Проверяем напрямую через запрос для сравнения
  const { data: directRejections, error: directRejectionsError } = await supabase
    .from('order_rejections')
    .select('order_id')
    .eq('driver_user_id', user.id)
  
  console.log('Driver Dashboard - Direct rejections count:', directRejections?.length || 0)
  console.log('Driver Dashboard - Direct rejections:', directRejections)
  if (directRejectionsError) {
    console.error('Driver Dashboard - Direct rejections error:', directRejectionsError)
  }
  
  // Если есть отказы, проверяем заказы
  if (directRejections && directRejections.length > 0) {
    const rejectionOrderIds = directRejections.map(r => r.order_id)
    console.log('Driver Dashboard - Rejection order IDs:', rejectionOrderIds)
    
    const { data: rejectedOrdersDirect, error: rejectedOrdersDirectError } = await supabase
      .from('orders')
      .select('id, order_number, status, pickup_address, delivery_address, final_price, item_type, description, created_at, cancelled_at')
      .in('id', rejectionOrderIds)
      .eq('status', 'searching_courier')
    
    console.log('Driver Dashboard - Direct rejected orders (searching_courier):', rejectedOrdersDirect)
    console.log('Driver Dashboard - Direct rejected orders count:', rejectedOrdersDirect?.length || 0)
    if (rejectedOrdersDirectError) {
      console.error('Driver Dashboard - Direct rejected orders error:', rejectedOrdersDirectError)
    }
  }
  
  // Для обратной совместимости используем rejectedOrders как cancelledOrders (скрытые заказы)
  let cancelledOrders = rejectedOrders || []
  
  // Fallback: если RPC функция не вернула данные, но есть прямые отказы, используем прямой запрос
  if ((!cancelledOrders || cancelledOrders.length === 0) && directRejections && directRejections.length > 0) {
    console.log('Driver Dashboard - RPC функция не вернула данные, используем fallback')
    const rejectionOrderIds = directRejections.map(r => r.order_id)
    const { data: fallbackOrders, error: fallbackError } = await supabase
      .from('orders')
      .select('id, order_number, pickup_address, delivery_address, final_price, item_type, description, created_at, cancelled_at, status')
      .in('id', rejectionOrderIds)
      .eq('status', 'searching_courier')
    
    if (!fallbackError && fallbackOrders) {
      console.log('Driver Dashboard - Fallback orders found:', fallbackOrders.length)
      cancelledOrders = fallbackOrders
    } else if (fallbackError) {
      console.error('Driver Dashboard - Fallback error:', fallbackError)
    }
  }
  
  // Дополнительная проверка: если функция вернула null или undefined, используем пустой массив
  if (!cancelledOrders) {
    console.warn('Driver Dashboard - cancelledOrders is null/undefined, using empty array')
    cancelledOrders = []
  }

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
      <DriverPushNotifications driverUserId={user.id} />
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
          <AvailableOrdersList 
            orders={filteredOrders} 
            driverUserId={user.id}
            cancelledOrders={cancelledOrders || []}
          />
        </div>
      </div>
      
      {/* Нижняя навигация */}
      <DriverBottomNavigation />
    </div>
    </>
  )
}
