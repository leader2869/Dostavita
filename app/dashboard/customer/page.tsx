import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'
import Link from 'next/link'

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
      <h1 className="text-3xl font-bold mb-6 text-white">Панель организации</h1>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-400 mb-2">Водителей в организации</h3>
          <p className="text-3xl font-bold text-white">{drivers?.length || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-400 mb-2">Активных заказов</h3>
          <p className="text-3xl font-bold text-green-400">{activeOrdersCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-400 mb-2">Завершенных заказов</h3>
          <p className="text-3xl font-bold text-blue-400">{completedOrdersCount}</p>
        </div>
      </div>

      {/* Водители */}
      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Мои водители</h2>
          <a
            href="/dashboard/customer/drivers"
            className="text-green-400 hover:text-green-300 text-sm"
          >
            Все водители →
          </a>
        </div>
        {drivers && drivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.slice(0, 6).map((driver: any) => (
              <div key={driver.id} className="border border-gray-700 rounded-lg p-4 bg-gray-700 hover:bg-gray-600 transition">
                <div className="flex items-center gap-3 mb-3">
                  {driver.avatar_url ? (
                    <img
                      src={driver.avatar_url}
                      alt={driver.full_name || 'Водитель'}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-white">{driver.full_name || 'Без имени'}</p>
                    <p className="text-sm text-gray-400">{driver.phone || 'Телефон не указан'}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-300">
                    <span className="text-gray-400">Транспорт:</span> {
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
                    <p className="text-gray-300">
                      <span className="text-gray-400">Номер:</span> {driver.vehicle_number}
                    </p>
                  )}
                </div>
                <a
                  href={`/dashboard/customer/drivers/${driver.id}`}
                  className="mt-3 block text-center bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
                >
                  Подробнее
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">У вас пока нет водителей. Добавьте водителей в разделе "Водители"</p>
        )}
      </div>

      {/* Последние заказы */}
      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Последние заказы</h2>
          <a
            href="/dashboard/customer/orders"
            className="text-green-400 hover:text-green-300 text-sm"
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
                let borderColor = 'border-gray-700'
                let bgColor = 'bg-gray-700'
                
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
                
                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/customer/orders/${order.id}`}
                    className={`block border ${borderColor} rounded-lg p-4 ${bgColor} hover:opacity-80 transition cursor-pointer`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-white">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                          {hasRejections && (
                            <span className="px-2 py-1 bg-red-500 text-white text-xs rounded">
                              Есть отказы
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 mt-1">
                          {order.pickup_address} → {order.delivery_address}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Статус: {order.status === 'searching_courier' ? 'Ищем курьера' :
                                   order.status === 'courier_coming' ? 'Курьер едет к вам' :
                                   order.status === 'courier_delivering' ? 'Курьер доставляет заказ' :
                                   order.status === 'completed' ? 'Заказ завершен' : 
                                   order.status === 'cancelled' ? 'Отменен' : order.status}
                        </p>
                        {order.driver_full_name && (
                          <p className="text-sm text-gray-400 mt-1">
                            Водитель: {order.driver_full_name}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Создан: {new Date(order.created_at).toLocaleString('ru-RU')}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-white">{order.final_price} BYN</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
          </div>
        ) : (
          <p className="text-gray-400">Пока нет заказов</p>
        )}
      </div>

      {/* Быстрые действия */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="/dashboard/customer/create-order"
          className="bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition text-center font-semibold"
        >
          Создать новый заказ
        </a>
        <a
          href="/dashboard/customer/drivers"
          className="bg-gray-700 text-white px-6 py-4 rounded-lg hover:bg-gray-600 transition text-center font-semibold"
        >
          Управление водителями
        </a>
      </div>

      {/* Нижняя навигация */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex justify-around items-center h-16">
          <a
            href="/dashboard/customer"
            className="flex flex-col items-center justify-center flex-1 h-full text-green-400 hover:text-green-300 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Главная</span>
          </a>
          <a
            href="/dashboard/customer/drivers"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs">Водители</span>
          </a>
          <a
            href="/dashboard/customer/orders"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Заказы</span>
          </a>
          <a
            href="/dashboard/customer/finance"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">Финансы</span>
          </a>
          <a
            href="/dashboard/customer/tracking"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">Отслеживание</span>
          </a>
        </div>
      </div>
    </div>
  )
}
