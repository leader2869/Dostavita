import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'
import { CustomerBottomNavigation } from '@/components/customer/CustomerBottomNavigation'

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
      case 'courier_accepted':
        return 'Курьер принял заказ'
      case 'courier_coming':
        return 'Курьер едет к отправителю'
      case 'courier_delivering':
        return 'Курьер едет к получателю'
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
      case 'courier_accepted':
        return 'text-orange-400 bg-orange-400/20 border-orange-400/50'
      case 'courier_coming':
        return 'text-blue-400 bg-blue-400/20 border-blue-400/50'
      case 'courier_delivering':
        return 'text-purple-400 bg-purple-400/20 border-purple-400/50'
      case 'completed':
        return 'text-brand-light bg-brand-light/20 border-green-400/50'
      case 'cancelled':
        return 'text-red-400 bg-red-400/20 border-red-400/50'
      default:
        return 'text-gray-600 bg-gray-400/20 border-gray-400/50'
    }
  }

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-gray-900">История заказов</h1>

      <div className="space-y-6">
        {/* Активные заказы */}
        {activeOrders.length > 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Активные заказы ({activeOrders.length})
            </h2>
            <div className="space-y-4">
              {activeOrders.map((order: any) => (
                <a
                  key={order.id}
                  href={`/dashboard/customer/orders/${order.id}`}
                  className="block border border-gray-200 rounded-lg p-4 bg-gray-100 hover:bg-gray-100 transition cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-700 mt-1">
                        а) {order.pickup_address}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        б) {order.delivery_address}
                      </p>
                      <div className="mt-2">
                        <span className="text-sm text-gray-600">Статус: </span>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                            getStatusColor(order.status)
                          }`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      {order.item_type && (
                        <p className="text-sm text-gray-600 mt-1">
                          Тип груза: <span className="text-gray-700">
                            {order.item_type === 'documents' ? 'Документы' :
                             order.item_type === 'parcel' ? 'Посылка' :
                             order.item_type === 'flowers' ? 'Цветы' :
                             order.item_type === 'food' ? 'Еда' :
                             order.item_type === 'other' ? 'Другое' : 'Не указан'}
                          </span>
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mt-1">
                        Создан: <span className="text-gray-700">
                          {new Date(order.created_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </p>
                      {order.description && (
                        <p className="text-sm text-gray-600 mt-1 italic">
                          {order.description}
                        </p>
                      )}
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
                      {order.driver_full_name && (
                        <p className="text-sm text-gray-600 mt-2">
                          Водитель: <span className="text-gray-700">{order.driver_full_name}</span>
                          {order.driver_phone && (
                            <span className="text-gray-600 ml-2">({order.driver_phone})</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-gray-900 text-lg">{order.final_price} BYN</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* История заказов */}
        {completedOrders.length > 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              История заказов ({completedOrders.length})
            </h2>
            <div className="space-y-4">
              {completedOrders.map((order: any) => (
                <a
                  key={order.id}
                  href={`/dashboard/customer/orders/${order.id}`}
                  className="block border border-gray-200 rounded-lg p-4 bg-gray-100 hover:bg-gray-100 transition cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-700 mt-1">
                        а) {order.pickup_address}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        б) {order.delivery_address}
                      </p>
                      <div className="mt-2">
                        <span className="text-sm text-gray-600">Статус: </span>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                            getStatusColor(order.status)
                          }`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      {order.driver_full_name && (
                        <p className="text-sm text-gray-600 mt-2">
                          Водитель: <span className="text-gray-700">{order.driver_full_name}</span>
                        </p>
                      )}
                      {order.completed_at && (
                        <p className="text-sm text-gray-600 mt-1">
                          Завершен: {new Date(order.completed_at).toLocaleString('ru-RU')}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-gray-900 text-lg">{order.final_price} BYN</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(order.created_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {orders?.length === 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <p className="text-gray-600 text-center">Пока нет заказов</p>
          </div>
        )}
      </div>

      <CustomerBottomNavigation />
    </div>
  )
}

