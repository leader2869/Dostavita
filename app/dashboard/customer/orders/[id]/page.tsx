import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { formatDistanceToNowStrict } from 'date-fns'
import { ru } from 'date-fns/locale'
import { DriverLocationMapWrapper } from '@/components/map/DriverLocationMapWrapper'
import { OrderStatusRealtime } from '@/components/customer/OrderStatusRealtime'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'

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

  // Получаем заказ напрямую из таблицы orders
  // Сначала пытаемся загрузить заказ напрямую
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      executor:profiles!orders_executor_user_id_fkey(id, full_name, phone),
      client:profiles!orders_client_id_fkey(id, full_name, phone),
      customer:profiles!orders_customer_id_fkey(id, full_name, phone)
    `)
    .eq('id', orderId)
    .single()

  if (orderError || !orderData) {
    console.error('Ошибка загрузки заказа:', orderError)
    notFound()
  }

  // Проверяем, что заказ принадлежит организации (создан ею) или выполняется водителем организации
  const { data: drivers } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', user.id)
    .eq('role', 'driver')

  const driverIds = drivers?.map((d: any) => d.id) || []
  
  const isOrganizationOrder = orderData.customer_id === user.id
  const isDriverOrder = orderData.executor_user_id && driverIds.includes(orderData.executor_user_id)

  if (!isOrganizationOrder && !isDriverOrder) {
    notFound()
  }

  const order = orderData

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
        return 'text-brand-light bg-brand-light/20 border-green-400/50'
      case 'cancelled':
        return 'text-red-400 bg-red-400/20 border-red-400/50'
      default:
        return 'text-gray-600 bg-gray-400/20 border-gray-400/50'
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
  const hasRejections = !!(rejections && rejections.length > 0)

  return (
    <div className="pb-20">
      <BackButton />

      <div className="bg-gray-50 rounded-lg shadow p-6 space-y-6">
        {/* Статус заказа */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Статус заказа</h2>
          <OrderStatusRealtime
            orderId={orderId}
            initialStatus={order.status}
            hasRejections={hasRejections}
            rejectionsCount={rejections?.length || 0}
          />
        </div>

        {/* Информация о заказе */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Информация о заказе</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Номер заказа</p>
              <p className="text-gray-900 font-medium">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Адрес отправления</p>
              <p className="text-gray-900">{formatAddressForOrder(order.pickup_address)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Адрес доставки</p>
              <p className="text-gray-900">{formatAddressForOrder(order.delivery_address)}</p>
            </div>

            {order.recipient_phone && (
              <div>
                <p className="text-sm text-gray-600">Телефон получателя</p>
                <p className="text-gray-900">
                  <a href={`tel:${order.recipient_phone}`} className="text-brand-light hover:text-brand-light font-medium">
                    {order.recipient_phone}
                  </a>
                </p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-600">Тип груза</p>
              <p className="text-gray-900">{getItemTypeLabel(order.item_type)}</p>
            </div>

            {order.description && (
              <div>
                <p className="text-sm text-gray-600">Описание</p>
                <p className="text-gray-900">{order.description}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-600">Стоимость</p>
              <p className="text-gray-900 text-xl font-semibold">{order.final_price} BYN</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Дата создания</p>
              <p className="text-gray-900">
                {new Date(order.created_at).toLocaleString('ru-RU')}
                {isActive && (
                  <span className="ml-2 text-purple-400 animate-blink">
                    ({formatDistanceToNowStrict(new Date(order.created_at), { addSuffix: true, locale: ru })})
                  </span>
                )}
              </p>
            </div>

            {/* Временные метки изменений статусов */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold mb-3 text-gray-900">История изменений статуса</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Время создания заказа</p>
                  <p className="text-gray-900">
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
                    <p className="text-sm text-gray-600">Время принятия заказа курьером</p>
                    <p className="text-gray-900">
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
                    <p className="text-sm text-gray-600">Время начала движения к отправителю</p>
                    <p className="text-gray-900">
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
                    <p className="text-sm text-gray-600">Время когда водитель забрал заказ</p>
                    <p className="text-gray-900">
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
                    <p className="text-sm text-gray-600">Время завершения заказа</p>
                    <p className="text-gray-900">
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
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Водитель</h2>
            <div className="space-y-2">
              <p className="text-gray-900">
                <span className="text-gray-600">Имя:</span> {order.driver_full_name}
              </p>
              {order.driver_phone && (
                <p className="text-gray-900">
                  <span className="text-gray-600">Телефон:</span> {order.driver_phone}
                </p>
              )}
              
              {/* Карта с местоположением водителя */}
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Местоположение водителя</p>
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
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Отказы водителей</h2>
            <div className="space-y-2">
              <p className="text-gray-600 text-sm">
                Количество отказов: <span className="text-gray-900 font-semibold">{rejections.length}</span>
              </p>
              <p className="text-gray-600 text-sm">
                Некоторые водители отказались от этого заказа
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

