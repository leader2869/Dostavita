import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'

export default async function DriverDashboard() {
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

  if (!profile || (profile as User).role !== 'driver') {
    redirect('/dashboard')
  }

  // Получаем доступные заказы (публичные, статус "ищем курьера")
  const { data: availableOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'searching_courier')
    .eq('visibility', 'public')
    .is('driver_id', null)
    .order('created_at', { ascending: false })
    .limit(10)

  // Получаем заказы водителя
  const { data: myOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('executor_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-white">Панель исполнителя</h1>
      
      {/* Навигация */}
      <div className="mb-6 flex gap-4">
        <a
          href="/dashboard/driver/profile"
          className="bg-gray-800 px-4 py-2 rounded-lg shadow hover:shadow-lg transition"
        >
          Профиль
        </a>
        <a
          href="/dashboard/driver/finance"
          className="bg-gray-800 px-4 py-2 rounded-lg shadow hover:shadow-lg transition"
        >
          Финансы
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Доступные заказы */}
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Доступные заказы</h2>
          {availableOrders && availableOrders.length > 0 ? (
            <div className="space-y-4">
              {availableOrders.map((order: any) => (
                <div key={order.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">Заказ #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-300">
                        {order.pickup_address} → {order.delivery_address}
                      </p>
                    </div>
                    <p className="font-semibold">{order.final_price} BYN</p>
                  </div>
                  <a
                    href={`/dashboard/driver/accept-order/${order.id}`}
                    className="inline-block bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                  >
                    Принять заказ
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">Нет доступных заказов</p>
          )}
        </div>

        {/* Мои заказы */}
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Мои заказы</h2>
          {myOrders && myOrders.length > 0 ? (
            <div className="space-y-4">
              {myOrders.map((order: any) => (
                <div key={order.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Заказ #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-300">
                        {order.pickup_address} → {order.delivery_address}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Статус: {order.status === 'courier_coming' ? 'Курьер едет к вам' :
                                 order.status === 'courier_delivering' ? 'Курьер доставляет заказ' :
                                 order.status === 'completed' ? 'Заказ завершен' : order.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{order.final_price} BYN</p>
                      <a
                        href={`/dashboard/driver/orders/${order.id}`}
                        className="text-sm text-green-500 hover:text-green-600"
                      >
                        Детали
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">У вас пока нет заказов</p>
          )}
        </div>
      </div>
    </div>
  )
}
