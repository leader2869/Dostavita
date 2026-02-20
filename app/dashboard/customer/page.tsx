import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'

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

  // Получаем статистику по заказам напрямую из таблицы orders
  // Используем прямую загрузку с учетом RLS политик
  // Сначала получаем ID всех водителей организации
  const driverIds = drivers?.map((d: any) => d.id) || []
  
  // Получаем заказы водителей организации и заказы, созданные самой организацией
  let allOrders: any[] = []
  
  // Заказы, созданные организацией
  const { data: orgCreatedOrders } = await supabase
    .from('orders')
    .select('id, status')
    .eq('customer_id', user.id)
  
  // Заказы водителей организации
  let driverOrders: any[] = []
  if (driverIds.length > 0) {
    const { data: driverOrdersData } = await supabase
      .from('orders')
      .select('id, status')
      .in('executor_user_id', driverIds)
    
    driverOrders = driverOrdersData || []
  }
  
  // Объединяем и убираем дубликаты
  const allOrderIds = new Set([
    ...(orgCreatedOrders?.map((o: any) => o.id) || []),
    ...(driverOrders.map((o: any) => o.id))
  ])
  
  allOrders = [
    ...(orgCreatedOrders || []),
    ...driverOrders.filter((o: any) => !orgCreatedOrders?.some((oc: any) => oc.id === o.id))
  ]

  // Подсчитываем статистику
  const activeOrdersCount = allOrders.filter((o: any) => 
    o.status !== 'completed' && o.status !== 'cancelled'
  ).length
  const completedOrdersCount = allOrders.filter((o: any) => 
    o.status === 'completed'
  ).length

  return (
    <div className="pb-20">
      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Водителей в организации</h3>
          <p className="text-3xl font-bold text-gray-900">{drivers?.length || 0}</p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Активных заказов</h3>
          <p className="text-3xl font-bold text-green-600">{activeOrdersCount}</p>
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
            Управление водителями →
          </a>
        </div>
        {drivers && drivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.slice(0, 6).map((driver: any) => (
              <a
                key={driver.id}
                href={`/dashboard/customer/drivers/${driver.id}`}
                className="block border border-gray-200 rounded-lg p-4 bg-gray-100 hover:bg-gray-200 transition cursor-pointer"
              >
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
              </a>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">У вас пока нет водителей. Добавьте водителей в разделе "Водители"</p>
        )}
      </div>

    </div>
  )
}
