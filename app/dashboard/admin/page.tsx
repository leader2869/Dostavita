import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

export default async function AdminDashboard() {
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

  if (!profile || ((profile as User).role !== 'admin' && (profile as User).role !== 'superadmin')) {
    redirect('/dashboard')
  }

  // Получаем статистику через RPC функцию (обходит RLS)
  const { data: stats, error: statsError } = await supabase
    .rpc('get_admin_stats')
    .single()
  
  // Fallback на прямые запросы, если RPC не работает
  let usersCount = (stats as { users_count?: number } | null)?.users_count || 0
  let driversCount = (stats as { drivers_count?: number } | null)?.drivers_count || 0
  let ordersCount = (stats as { orders_count?: number } | null)?.orders_count || 0
  
  if (statsError || !stats) {
    console.log('AdminDashboard - RPC не сработал, пробуем прямые запросы...')
    
    const { count: ordersCountDirect } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
    
    const { count: usersCountDirect } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    
    const { count: driversCountDirect } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
    
    if (ordersCountDirect !== null) ordersCount = ordersCountDirect
    if (usersCountDirect !== null) usersCount = usersCountDirect
    if (driversCountDirect !== null) driversCount = driversCountDirect
  }
  
  console.log('AdminDashboard - Статистика:', {
    users: usersCount,
    drivers: driversCount,
    orders: ordersCount,
    error: statsError?.message
  })

  // Получаем счетчики заказов
  // 1. Активные заказы (searching_courier, courier_coming, courier_delivering)
  const { count: activeOrdersCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['searching_courier', 'courier_coming', 'courier_delivering'])
  
  // 2. Заказы где ищем курьера (searching_courier)
  const { count: searchingCourierCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'searching_courier')
  
  // 3. Заказы которые выполняются (courier_coming, courier_delivering)
  const { count: inProgressCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['courier_coming', 'courier_delivering'])

  // Получаем настройки доставки
  let { data: deliverySettings } = await supabase
    .rpc('get_delivery_settings')
  
  // Fallback на прямой запрос
  if (!deliverySettings || deliverySettings.length === 0) {
    const { data: directSettings } = await supabase
      .from('delivery_settings')
      .select('*')
    
    if (directSettings) {
      deliverySettings = directSettings
    }
  }

  // Создаем объект для быстрого доступа к настройкам
  const settingsMap: Record<string, number> = {}
  if (deliverySettings) {
    deliverySettings.forEach((setting: any) => {
      settingsMap[setting.setting_key] = setting.setting_value
    })
  }

  // Получаем активные заказы для отображения списка (статусы: searching_courier, courier_coming, courier_delivering)
  // Сортируем по времени создания (старые сверху)
  let { data: activeOrders, error: activeOrdersError } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['searching_courier', 'courier_coming', 'courier_delivering'])
    .order('created_at', { ascending: true })
    .limit(20)
  
  // Fallback, если прямой запрос не работает
  if (activeOrdersError || !activeOrders) {
    console.log('AdminDashboard - Прямой запрос активных заказов не сработал, пробуем RPC...')
    const { data: allOrders } = await supabase
      .rpc('get_all_orders_for_admin', { limit_count: 100 })
    
    if (allOrders) {
      activeOrders = allOrders.filter((order: any) => 
        ['searching_courier', 'courier_coming', 'courier_delivering'].includes(order.status)
      ).sort((a: any, b: any) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ).slice(0, 20)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-white">
        Панель администратора
        {(profile as User).role === 'superadmin' && ' (Суперадмин)'}
      </h1>

      {/* Статистика заказов */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2 text-white">Активные заказы</h2>
          <p className="text-3xl font-bold text-white">{activeOrdersCount || 0}</p>
          <p className="text-sm text-gray-400 mt-1">Ищем курьера, в пути, доставляется</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2 text-white">Ищем курьера</h2>
          <p className="text-3xl font-bold text-white">{searchingCourierCount || 0}</p>
          <p className="text-sm text-gray-400 mt-1">Ожидают принятия водителем</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2 text-white">Выполняются</h2>
          <p className="text-3xl font-bold text-white">{inProgressCount || 0}</p>
          <p className="text-sm text-gray-400 mt-1">Курьер едет, доставляется</p>
        </div>
      </div>

      {/* Активные заказы */}
      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Активные заказы</h2>
        {activeOrders && activeOrders.length > 0 ? (
          <div className="space-y-3">
            {activeOrders.map((order: any) => {
              // Определяем время последнего изменения статуса
              let statusTime: Date | null = null
              let statusLabel = ''
              
              if (order.status === 'searching_courier') {
                statusTime = new Date(order.created_at)
                statusLabel = 'Ищем курьера'
              } else if (order.status === 'courier_coming') {
                statusTime = order.accepted_at ? new Date(order.accepted_at) : new Date(order.created_at)
                statusLabel = 'Едем за посылкой'
              } else if (order.status === 'courier_delivering') {
                statusTime = order.picked_up_at ? new Date(order.picked_up_at) : 
                            order.started_delivery_at ? new Date(order.started_delivery_at) :
                            order.accepted_at ? new Date(order.accepted_at) : 
                            new Date(order.created_at)
                statusLabel = 'Доставляем заказ'
              }

              const timeAgo = statusTime ? formatDistanceToNow(statusTime, {
                addSuffix: false,
                locale: ru
              }) : ''

              // Вычисляем время в минутах с момента изменения статуса
              const minutesElapsed = statusTime ? Math.floor((Date.now() - statusTime.getTime()) / 60000) : 0
              
              // Определяем лимит для текущего статуса
              let maxMinutes = 0
              if (order.status === 'searching_courier') {
                maxMinutes = settingsMap['max_searching_courier_minutes'] || 5
              } else if (order.status === 'courier_coming') {
                maxMinutes = settingsMap['max_courier_coming_minutes'] || 30
              } else if (order.status === 'courier_delivering') {
                maxMinutes = settingsMap['max_courier_delivering_minutes'] || 60
              }

              // Проверяем, превышен ли лимит
              const isOverdue = minutesElapsed > maxMinutes

              return (
                <div 
                  key={order.id} 
                  className={`border rounded-lg p-4 ${
                    isOverdue 
                      ? 'border-red-600 bg-red-900 bg-opacity-20' 
                      : 'border-gray-700 bg-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-white">Заказ №{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-300 mt-1">
                        {order.pickup_address} → {order.delivery_address}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Статус: {
                          order.status === 'searching_courier' ? 'Ищем курьера' :
                          order.status === 'courier_coming' ? 'Курьер едет' :
                          order.status === 'courier_delivering' ? 'Доставляется' :
                          order.status
                        }
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-white">{order.final_price} BYN</p>
                      {statusTime && timeAgo && (
                        <p className="text-xs text-purple-400 mt-1 font-medium animate-blink">
                          {statusLabel} {timeAgo}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400">Нет активных заказов</p>
        )}
      </div>

      {/* Навигация */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <a
          href="/dashboard/admin/orders"
          className="bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
        >
          <h3 className="font-semibold text-white">Управление заказами</h3>
        </a>

        <a
          href="/dashboard/admin/users"
          className="bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
        >
          <h3 className="font-semibold text-white">Управление пользователями</h3>
        </a>

        <a
          href="/dashboard/admin/personnel"
          className="bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
        >
          <h3 className="font-semibold text-white">Управление персоналом</h3>
        </a>

        {(profile as User).role === 'superadmin' && (
          <>
            <a
              href="/dashboard/admin/tariffs"
              className="bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
            >
              <h3 className="font-semibold text-white">Управление тарифами</h3>
            </a>
            <a
              href="/dashboard/admin/delivery-settings"
              className="bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
            >
              <h3 className="font-semibold text-white">Настройки доставки</h3>
            </a>
          </>
        )}
      </div>
    </div>
  )
}

