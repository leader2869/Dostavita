import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'
import Link from 'next/link'
import { CustomerBottomNavigation } from '@/components/customer/CustomerBottomNavigation'
import { GeneralChatButton } from '@/components/customer/GeneralChatButton'

export default async function CustomerDashboard() {
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

  if (!profile || (profile as User).role !== 'customer') {
    redirect('/dashboard')
  }

  // Получаем водителей организации через RPC функцию
  const { data: drivers, error: driversError } = await supabase
    .rpc('get_organization_drivers', { organization_user_id: user.id })

  // Получаем статистику по заказам водителей
  const { data: organizationOrders } = await supabase
    .rpc('get_organization_orders', { organization_user_id: user.id })

  // Получаем информацию об отказах для заказов
  const orderIds = organizationOrders?.map((o: any) => o.id) || []
  const { data: rejections } = orderIds.length > 0 ? await supabase
    .from('order_rejections')
    .select('order_id')
    .in('order_id', orderIds) : { data: null }
  
  const rejectedOrderIds = new Set(rejections?.map((r: any) => r.order_id) || [])

  // Подсчитываем статистику
  const activeOrdersCount = organizationOrders?.filter((o: any) => 
    o.status !== 'completed' && o.status !== 'cancelled'
  ).length || 0
  const completedOrdersCount = organizationOrders?.filter((o: any) => 
    o.status === 'completed'
  ).length || 0
  const totalEarnings = organizationOrders?.filter((o: any) => o.status === 'completed')
    .reduce((sum: number, o: any) => sum + (parseFloat(o.final_price) || 0), 0) || 0

  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Панель организации</h1>
        <GeneralChatButton
          organizationId={user.id}
          currentUserId={user.id}
        />
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Водителей в организации</h3>
          <p className="text-3xl font-bold text-gray-900">{drivers?.length || 0}</p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Активных заказов</h3>
          <p className="text-3xl font-bold text-brand-light">{activeOrdersCount}</p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Завершенных заказов</h3>
          <p className="text-3xl font-bold text-blue-400">{completedOrdersCount}</p>
        </div>
      </div>

      {/* Водители */}
      <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Мои водители</h2>
          <a
            href="/dashboard/customer/drivers"
            className="text-brand-light hover:text-brand-dark text-sm"
          >
            Все водители →
          </a>
        </div>
        {drivers && drivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.slice(0, 6).map((driver: any) => (
              <div key={driver.id} className="border border-gray-200 rounded-lg p-4 bg-gray-100 hover:bg-gray-100 transition">
                <div className="flex items-center gap-3 mb-3">
                  {driver.avatar_url ? (
                    <img
                      src={driver.avatar_url}
                      alt={driver.full_name || 'Водитель'}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{driver.full_name || 'Без имени'}</p>
                    <p className="text-sm text-gray-600">{driver.phone || 'Телефон не указан'}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
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
                      <span className="text-gray-600">Номер:</span> {driver.vehicle_number}
                    </p>
                  )}
                </div>
                <a
                  href={`/dashboard/customer/drivers/${driver.id}`}
                  className="mt-3 block text-center bg-brand-light text-gray-900 px-4 py-2 rounded text-sm hover:bg-brand-dark transition"
                >
                  Подробнее
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">У вас пока нет водителей. Добавьте водителей в разделе "Водители"</p>
        )}
      </div>

      {/* Последние заказы */}
      <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Последние заказы</h2>
          <a
            href="/dashboard/customer/orders"
            className="text-brand-light hover:text-brand-dark text-sm"
          >
            Все заказы →
          </a>
        </div>
        {organizationOrders && organizationOrders.length > 0 ? (
          <div className="space-y-4">
            {organizationOrders
              .sort((a: any, b: any) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
              .slice(0, 10)
              .map((order: any) => {
                const isActive = order.status !== 'completed' && order.status !== 'cancelled'
                const isCompleted = order.status === 'completed'
                const hasRejections = rejectedOrderIds.has(order.id)
                
                // Определяем цвет подсветки
                let borderColor = 'border-gray-200'
                let bgColor = 'bg-gray-100'
                
                if (hasRejections) {
                  // Заказы с отказами - красным
                  borderColor = 'border-red-500'
                  bgColor = 'bg-red-900/30'
                } else if (isCompleted) {
                  // Выполненные заказы - зеленым
                  borderColor = 'border-green-500'
                  bgColor = 'bg-green-900/30'
                } else if (isActive) {
                  // Активные заказы - желтым
                  borderColor = 'border-yellow-500'
                  bgColor = 'bg-yellow-900/30'
                }
                
                const canCancel = order.status === 'searching_courier' && !order.executor_user_id
                
                return (
                  <div
                    key={order.id}
                    className={`border ${borderColor} rounded-lg p-4 ${bgColor} hover:opacity-80 transition`}
                  >
                    <Link
                      href={`/dashboard/customer/orders/${order.id}`}
                      className="block cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-900">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                            {hasRejections && (
                              <span className="px-2 py-1 bg-red-500 text-gray-900 text-xs rounded">
                                Есть отказы
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mt-1">
                            {order.pickup_address} → {order.delivery_address}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Статус: {order.status === 'searching_courier' ? 'Ищем курьера' :
                                     order.status === 'courier_accepted' ? 'Курьер принял заказ' :
                                     order.status === 'courier_coming' ? 'Курьер едет к отправителю' :
                                     order.status === 'courier_delivering' ? 'Курьер едет к получателю' :
                                     order.status === 'completed' ? 'Заказ завершен' : 
                                     order.status === 'cancelled' ? 'Отменен' : order.status}
                          </p>
                          {order.driver_full_name && (
                            <p className="text-sm text-gray-600 mt-1">
                              Водитель: {order.driver_full_name}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Создан: {new Date(order.created_at).toLocaleString('ru-RU')}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold text-gray-900">{order.final_price} BYN</p>
                        </div>
                      </div>
                    </Link>
                    {canCancel && (
                      <div className="mt-3">
                        <button
                          onClick={async (e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!confirm('Вы уверены, что хотите отменить этот заказ?')) {
                              return
                            }
                            try {
                              const response = await fetch(`/api/orders/${order.id}/cancel`, {
                                method: 'POST',
                              })
                              const data = await response.json()
                              if (response.ok) {
                                alert('Заказ успешно отменен')
                                window.location.reload()
                              } else {
                                alert(data.error || 'Не удалось отменить заказ')
                              }
                            } catch (error) {
                              console.error('Ошибка отмены заказа:', error)
                              alert('Произошла ошибка при отмене заказа')
                            }
                          }}
                          className="w-full bg-red-600 text-gray-900 px-3 py-1.5 rounded text-xs hover:bg-red-700 transition"
                        >
                          Отменить заказ
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        ) : (
          <p className="text-gray-600">Пока нет заказов</p>
        )}
      </div>

      {/* Быстрые действия */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="/dashboard/customer/create-order"
          className="bg-brand-light text-gray-900 px-6 py-4 rounded-lg hover:bg-brand-dark transition text-center font-semibold"
        >
          Создать новый заказ
        </a>
        <a
          href="/dashboard/customer/drivers"
          className="bg-gray-100 text-gray-900 px-6 py-4 rounded-lg hover:bg-gray-100 transition text-center font-semibold"
        >
          Управление водителями
        </a>
      </div>

      <CustomerBottomNavigation />
    </div>
  )
}
