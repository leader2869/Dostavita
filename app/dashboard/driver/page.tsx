import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@/lib/types'
import { getCachedUserAndProfile } from '@/lib/supabase/cached-auth'
import { AvailableOrdersList } from '@/components/driver/AvailableOrdersList'
import { DriverLocationTracker } from '@/components/driver/DriverLocationTracker'
import { DriverPushNotifications } from '@/components/driver/DriverPushNotifications'
import { OrderActions } from '@/components/driver/OrderActions'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'

export const dynamic = 'force-dynamic'

export default async function DriverDashboard() {
  const supabase = createServerSupabaseClient()
  const { user, profile, authError } = await getCachedUserAndProfile()

  if (authError || !user) redirect('/login')
  if (!profile || (profile as User).role !== 'driver') redirect('/dashboard')

  const organizationId = (profile as { organization_id?: string }).organization_id

         // Получаем доступные заказы (все заказы со статусом "ищем курьера")
         // Включаем заказы, которые были отменены, но сейчас снова активны (статус searching_courier)
         const { data: availableOrders } = await supabase
           .from('orders')
           .select('id, order_number, pickup_address, delivery_address, final_price, item_type, description, created_at, cancelled_at, ready_at')
           .eq('status', 'searching_courier')
           .order('created_at', { ascending: false })
           .limit(10)

  // Получаем заказы, от которых водитель отказался (скрытые заказы)
  const { data: rejectedOrders, error: rejectedOrdersError } = await supabase
    .rpc('get_driver_rejected_orders', { p_driver_user_id: user.id })

  if (rejectedOrdersError) {
    console.error('Ошибка загрузки скрытых заказов:', rejectedOrdersError)
  }
  
  const { data: directRejections, error: directRejectionsError } = await supabase
    .from('order_rejections')
    .select('order_id')
    .eq('driver_user_id', user.id)
  
  if (directRejectionsError) {
    console.error('Ошибка загрузки отказов (direct):', directRejectionsError)
  }
  
  if (directRejections && directRejections.length > 0) {
    const rejectionOrderIds = directRejections.map(r => r.order_id)
    
    const { data: rejectedOrdersDirect, error: rejectedOrdersDirectError } = await supabase
             .from('orders')
             .select('id, order_number, status, pickup_address, delivery_address, final_price, item_type, description, created_at, cancelled_at, ready_at')
             .in('id', rejectionOrderIds)
             .eq('status', 'searching_courier')
    
    if (rejectedOrdersDirectError) {
      console.error('Ошибка загрузки отклонённых заказов:', rejectedOrdersDirectError)
    }
  }
  
  let cancelledOrders = rejectedOrders || []
  
  if ((!cancelledOrders || cancelledOrders.length === 0) && directRejections && directRejections.length > 0) {
    const rejectionOrderIds = directRejections.map(r => r.order_id)
    const { data: fallbackOrders, error: fallbackError } = await supabase
             .from('orders')
             .select('id, order_number, pickup_address, delivery_address, final_price, item_type, description, created_at, cancelled_at, status, ready_at')
             .in('id', rejectionOrderIds)
             .eq('status', 'searching_courier')
    
    if (!fallbackError && fallbackOrders) {
      cancelledOrders = fallbackOrders
    } else if (fallbackError) {
      console.error('Ошибка fallback загрузки отклонённых заказов:', fallbackError)
    }
  }
  
  if (!cancelledOrders) {
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

  // Получаем активные заказы водителя (где executor_user_id равен ID текущего пользователя)
  // Пробуем сначала без фильтра по статусу, чтобы увидеть все заказы
  const { data: allMyOrders, error: allOrdersError } = await supabase
    .from('orders')
    .select('id, executor_user_id, status, created_at, customer_id, client_id')
    .eq('executor_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (allOrdersError) {
    console.error('Ошибка загрузки заказов водителя:', allOrdersError)
  }

  const { data: myOrders, error: myOrdersError } = await supabase
           .from('orders')
           .select('id, order_number, pickup_address, delivery_address, final_price, item_type, description, created_at, cancelled_at, status, customer_id, client_id, executor_user_id, sender_phone, recipient_phone, pickup_coordinates, delivery_coordinates, ready_at')
           .eq('executor_user_id', user.id)
           .in('status', ['courier_accepted', 'courier_coming', 'courier_delivering'])
           .order('created_at', { ascending: false })
           .limit(10)

  if (myOrdersError) {
    console.error('Ошибка загрузки активных заказов водителя:', myOrdersError)
  }

  return (
    <>
      <DriverLocationTracker />
      <DriverPushNotifications driverUserId={user.id} />
      <div className="pb-20">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Активные заказы - показываем первыми */}
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Активные заказы</h2>
          {myOrders && myOrders.length > 0 ? (
            <div className="space-y-4">
              {myOrders.map((order: any) => (
                <div
                  key={order.id}
                  className="block border rounded-lg p-4 hover:bg-gray-100 transition"
                >
                  <Link
                    href={`/dashboard/driver/orders/${order.id}`}
                    className="block"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                        <p className="text-sm text-gray-700 mt-1">
                          а) {formatAddressForOrder(order.pickup_address)}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          б) {formatAddressForOrder(order.delivery_address)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Статус: {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || order.status}
                        </p>
                        {order.ready_at && (() => {
                          const { formattedTime, timeStatus, statusType } = formatReadyTime(order.ready_at)
                          return (
                            <p className="text-sm text-gray-600 mt-1">
                              Заказ будет готов к выдаче: <span className="text-gray-700">{formattedTime}</span>
                              {timeStatus && (
                                <span className={`ml-2 ${statusType === 'waiting' ? 'text-red-400 animate-blink' : statusType === 'upcoming' ? 'text-yellow-400 animate-blink' : 'text-gray-600'}`}>
                                  ({timeStatus})
                                </span>
                              )}
                            </p>
                          )
                        })()}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{order.final_price} BYN</p>
                      </div>
                    </div>
                  </Link>
                  <OrderActions order={order} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">У вас пока нет активных заказов</p>
          )}
        </div>

        {/* Доступные заказы - показываем вторыми */}
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Доступные заказы</h2>
          <AvailableOrdersList 
            orders={filteredOrders} 
            driverUserId={user.id}
            cancelledOrders={cancelledOrders || []}
          />
        </div>
      </div>

    </div>
    </>
  )
}
