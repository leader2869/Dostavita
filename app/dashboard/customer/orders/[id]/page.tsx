import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { CustomerBottomNavigation } from '@/components/customer/CustomerBottomNavigation'
import { formatDistanceToNowStrict } from 'date-fns'
import { ru } from 'date-fns/locale'
import { DriverLocationMapWrapper } from '@/components/map/DriverLocationMapWrapper'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'

export default async function CustomerOrderDetailsPage({ params }: { params: { id: string } }) {
  const orderId = params.id
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

  // Получаем заказы организации
  const { data: orders, error: ordersError } = await supabase
    .rpc('get_organization_orders', { organization_user_id: user.id })

  if (ordersError) {
    console.error('Ошибка загрузки заказов:', ordersError)
  }

  const order = orders?.find((o: any) => o.id === orderId)

  if (!order) {
    notFound()
  }

  // Получаем информацию об отказах для этого заказа
  const { data: rejections } = await supabase
    .from('order_rejections')
    .select('*')
    .eq('order_id', orderId)

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
        return 'text-green-400 bg-green-400/20 border-green-400/50'
      case 'cancelled':
        return 'text-red-400 bg-red-400/20 border-red-400/50'
      default:
        return 'text-gray-400 bg-gray-400/20 border-gray-400/50'
    }
  }

  const getItemTypeLabel = (itemType: string) => {
    switch (itemType) {
      case 'documents':
        return 'Документы'
      case 'parcel':
        return 'Посылка'
      case 'flowers':
        return 'Цветы'
      case 'food':
        return 'Еда'
      case 'other':
        return 'Другое'
      default:
        return itemType || 'Не указан'
    }
  }

  const isActive = order.status !== 'completed' && order.status !== 'cancelled'
  const isCompleted = order.status === 'completed'
  const hasRejections = rejections && rejections.length > 0

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Детали заказа</h1>

      <div className="bg-gray-800 rounded-lg shadow p-6 space-y-6">
        {/* Статус заказа */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-white">Статус заказа</h2>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
            {hasRejections && (
              <span className="px-3 py-1 bg-red-500 text-white text-sm rounded">
                Есть отказы ({rejections.length})
              </span>
            )}
          </div>
        </div>

        {/* Информация о заказе */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-white">Информация о заказе</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-400">Номер заказа</p>
              <p className="text-white font-medium">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Адрес отправления</p>
              <p className="text-white">{formatAddressForOrder(order.pickup_address)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Адрес доставки</p>
              <p className="text-white">{formatAddressForOrder(order.delivery_address)}</p>
            </div>

            {order.recipient_phone && (
              <div>
                <p className="text-sm text-gray-400">Телефон получателя</p>
                <p className="text-white">
                  <a href={`tel:${order.recipient_phone}`} className="text-green-500 hover:text-green-400 font-medium">
                    {order.recipient_phone}
                  </a>
                </p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-400">Тип груза</p>
              <p className="text-white">{getItemTypeLabel(order.item_type)}</p>
            </div>

            {order.description && (
              <div>
                <p className="text-sm text-gray-400">Описание</p>
                <p className="text-white">{order.description}</p>
              </div>
            )}

            {order.ready_at && (() => {
              const { formattedTime, timeStatus, statusType } = formatReadyTime(order.ready_at)
              return (
                <div>
                  <p className="text-sm text-gray-400">Заказ будет готов к</p>
                  <p className="text-white">
                    {formattedTime}
                    {timeStatus && (
                      <span className={`ml-2 ${statusType === 'waiting' ? 'text-red-400 animate-blink' : statusType === 'upcoming' ? 'text-yellow-400 animate-blink' : 'text-gray-400'}`}>
                        ({timeStatus})
                      </span>
                    )}
                  </p>
                </div>
              )
            })()}

            <div>
              <p className="text-sm text-gray-400">Стоимость</p>
              <p className="text-white text-xl font-semibold">{order.final_price} BYN</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Дата создания</p>
              <p className="text-white">
                {new Date(order.created_at).toLocaleString('ru-RU')}
                {isActive && (
                  <span className="ml-2 text-purple-400 animate-blink">
                    ({formatDistanceToNowStrict(new Date(order.created_at), { addSuffix: true, locale: ru })})
                  </span>
                )}
              </p>
            </div>

            {/* Временные метки изменений статусов */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h3 className="text-lg font-semibold mb-3 text-white">История изменений статуса</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-400">Время создания заказа</p>
                  <p className="text-white">
                    {new Date(order.created_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {order.accepted_at && (
                  <div>
                    <p className="text-sm text-gray-400">Время принятия заказа курьером</p>
                    <p className="text-white">
                      {new Date(order.accepted_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}

                {order.started_coming_at && (
                  <div>
                    <p className="text-sm text-gray-400">Время начала движения к отправителю</p>
                    <p className="text-white">
                      {new Date(order.started_coming_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}

                {order.picked_up_at && (
                  <div>
                    <p className="text-sm text-gray-400">Время когда водитель забрал заказ</p>
                    <p className="text-white">
                      {new Date(order.picked_up_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}

                {order.completed_at && (
                  <div>
                    <p className="text-sm text-gray-400">Время завершения заказа</p>
                    <p className="text-white">
                      {new Date(order.completed_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Информация о водителе */}
        {order.driver_full_name && order.executor_user_id && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-white">Водитель</h2>
            <div className="space-y-2">
              <p className="text-white">
                <span className="text-gray-400">Имя:</span> {order.driver_full_name}
              </p>
              {order.driver_phone && (
                <p className="text-white">
                  <span className="text-gray-400">Телефон:</span> {order.driver_phone}
                </p>
              )}
              
              {/* Карта с местоположением водителя */}
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-2">Местоположение водителя</p>
                <DriverLocationMapWrapper
                  driverId={order.executor_user_id}
                  orderId={order.id}
                  height="300px"
                  zoom={15}
                />
              </div>
            </div>
          </div>
        )}

        {/* Информация об отказах */}
        {hasRejections && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-white">Отказы водителей</h2>
            <div className="space-y-2">
              <p className="text-gray-400 text-sm">
                Количество отказов: <span className="text-white font-semibold">{rejections.length}</span>
              </p>
              <p className="text-gray-400 text-sm">
                Некоторые водители отказались от этого заказа
              </p>
            </div>
          </div>
        )}
      </div>

      <CustomerBottomNavigation />
    </div>
  )
}

