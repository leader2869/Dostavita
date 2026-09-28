import { loadDriverDashboardOrders } from '@/lib/driver-dashboard-orders'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@/lib/types'
import { getCachedUserAndProfile } from '@/lib/supabase/cached-auth'
import { AvailableOrdersList } from '@/components/driver/AvailableOrdersList'
import { DriverLocationTracker } from '@/components/driver/DriverLocationTracker'
import { DriverChatSection } from '@/components/driver/DriverChatSection'
import { DriverPushNotifications } from '@/components/driver/DriverPushNotifications'
import { OrderActions } from '@/components/driver/OrderActions'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'

export const dynamic = 'force-dynamic'

export default async function DriverDashboard() {
  const supabase = await createServerSupabaseClient()
  const { user, profile, authError } = await getCachedUserAndProfile()

  if (authError || !user) redirect('/login')
  if (!profile || (profile as User).role !== 'driver') redirect('/dashboard')

  // The legacy get_user_profile RPC omits organization_id. Read affiliation
  // from the authenticated user's own row instead of assuming it is returned.
  const { data: affiliation } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  const organizationId = affiliation?.organization_id

  const { available: filteredOrders, hidden: cancelledOrders, active: myOrders } =
    await loadDriverDashboardOrders(supabase, user.id)

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
      {organizationId && (
        <div className="mt-6">
          <DriverChatSection driverUserId={user.id} organizationId={organizationId} />
        </div>
      )}

    </div>
    </>
  )
}
