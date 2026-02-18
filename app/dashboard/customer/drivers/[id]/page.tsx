import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'
import { CustomerBottomNavigation } from '@/components/customer/CustomerBottomNavigation'
import { DriverChatButton } from '@/components/customer/DriverChatButton'

export default async function DriverDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const driverId = params.id

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

  // Получаем информацию о водителе
  const { data: drivers } = await supabase
    .rpc('get_organization_drivers', { organization_user_id: user.id })

  const driver = drivers?.find((d: any) => d.id === driverId)

  if (!driver) {
    notFound()
  }

  // Получаем заказы водителя
  const { data: orders } = await supabase
    .rpc('get_organization_orders', { organization_user_id: user.id })

  const driverOrders = orders?.filter((o: any) => o.executor_user_id === driverId) || []

  // Разделяем на активные и завершенные
  const activeOrders = driverOrders.filter((o: any) => 
    o.status !== 'completed' && o.status !== 'cancelled'
  )
  const completedOrders = driverOrders.filter((o: any) => 
    o.status === 'completed' || o.status === 'cancelled'
  )

  // Получаем финансы водителя
  const { data: finances } = await supabase
    .rpc('get_organization_finances', { 
      organization_user_id: user.id,
      start_date: null,
      end_date: null
    })

  const driverFinance = finances?.find((f: any) => f.driver_id === driverId)

  // Получаем баланс водителя
  const { data: balance, error: balanceError } = await supabase
    .from('balances')
    .select('amount, currency')
    .eq('user_id', driverId)
    .maybeSingle()
  
  // Если баланса нет, создаем нулевой баланс для отображения
  const displayBalance = balance || { amount: 0, currency: 'BYN' }

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
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Информация о водителе</h1>

      {/* Информация о водителе */}
      <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
        <div className="flex items-start gap-6">
          {driver.avatar_url ? (
            <img
              src={driver.avatar_url}
              alt={driver.full_name || 'Водитель'}
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{driver.full_name || 'Без имени'}</h2>
            <div className="space-y-1 text-sm">
              <p className="text-gray-700">
                <span className="text-gray-600">Email:</span> {driver.email}
              </p>
              {driver.phone && (
                <p className="text-gray-700">
                  <span className="text-gray-600">Телефон:</span> {driver.phone}
                </p>
              )}
              <p className="text-gray-700">
                <span className="text-gray-600">Транспорт:</span> {
                  driver.vehicle_type === 'car' ? 'Автомобиль' :
                  driver.vehicle_type === 'motorcycle' ? 'Мотоцикл' :
                  driver.vehicle_type === 'bicycle' ? 'Велосипед' :
                  driver.vehicle_type === 'walking' ? 'Пешком' : driver.vehicle_type || 'Не указан'
                }
                {driver.vehicle_brand && driver.vehicle_model && (
                  <span className="ml-1">({driver.vehicle_brand} {driver.vehicle_model})</span>
                )}
              </p>
              {driver.vehicle_number && (
                <p className="text-gray-700">
                  <span className="text-gray-600">Номер транспорта:</span> {driver.vehicle_number}
                </p>
              )}
              {driver.license_number && (
                <p className="text-gray-700">
                  <span className="text-gray-600">Удостоверение:</span> {driver.license_number}
                </p>
              )}
              {driver.current_location && (
                <p className="text-brand-light mt-2">
                  <span className="text-gray-600">Статус:</span> 📍 Онлайн
                </p>
              )}
              {!driver.current_location && (
                <p className="text-gray-500 mt-2">
                  <span className="text-gray-600">Статус:</span> ⚫ Офлайн
                </p>
              )}
              {driver.location_updated_at && (
                <p className="text-gray-600 text-xs mt-1">
                  Последнее обновление: {formatDistanceToNow(new Date(driver.location_updated_at), { addSuffix: true, locale: ru })}
                </p>
              )}
            </div>
          </div>
          <div className="text-right flex flex-col gap-2">
            <a
              href={`/dashboard/customer/tracking?driver=${driver.id}`}
              className="bg-brand-light text-gray-900 px-4 py-2 rounded-md hover:bg-brand-dark transition inline-block text-center"
            >
              Отследить на карте
            </a>
            <DriverChatButton
              organizationId={user.id}
              driverId={driverId}
              currentUserId={user.id}
            />
          </div>
        </div>
      </div>

      {/* Финансы */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Баланс</h3>
          <p className="text-3xl font-bold text-gray-900">
            {displayBalance.amount ? parseFloat(displayBalance.amount).toFixed(2) : '0.00'} {displayBalance.currency || 'BYN'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Завершенных заказов</h3>
          <p className="text-3xl font-bold text-brand-light">
            {driverFinance?.completed_orders_count || completedOrders.length}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Общая сумма</h3>
          <p className="text-3xl font-bold text-blue-400">
            {driverFinance ? parseFloat(driverFinance.total_earnings || 0).toFixed(2) : '0.00'} BYN
          </p>
        </div>
      </div>

      {/* Заказы */}
      <div className="space-y-6">
        {/* Активные заказы */}
        {activeOrders.length > 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Активные заказы ({activeOrders.length})
            </h2>
            <div className="space-y-4">
              {activeOrders.map((order: any) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4 bg-gray-100 hover:bg-gray-100 transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-700 mt-1">
                        а) {formatAddressForOrder(order.pickup_address)}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        б) {formatAddressForOrder(order.delivery_address)}
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
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-gray-900 text-lg">{order.final_price} BYN</p>
                    </div>
                  </div>
                </div>
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
              {completedOrders.slice(0, 10).map((order: any) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4 bg-gray-100 hover:bg-gray-100 transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-700 mt-1">
                        {order.pickup_address} → {order.delivery_address}
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
                      {order.completed_at && (
                        <p className="text-sm text-gray-600 mt-2">
                          Завершен: {new Date(order.completed_at).toLocaleString('ru-RU')}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-gray-900 text-lg">{order.final_price} BYN</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {driverOrders.length === 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <p className="text-gray-600 text-center">У водителя пока нет заказов</p>
          </div>
        )}
      </div>

      <CustomerBottomNavigation />
    </div>
  )
}

