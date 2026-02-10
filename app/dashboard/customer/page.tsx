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

  // Получаем заказы организации
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Панель организации</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Мои заказы</h2>
        {orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <div key={order.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Заказ #{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-gray-600">
                      {order.pickup_address} → {order.delivery_address}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Статус: {order.status === 'searching_courier' ? 'Ищем курьера' :
                               order.status === 'courier_coming' ? 'Курьер едет к вам' :
                               order.status === 'courier_delivering' ? 'Курьер доставляет заказ' :
                               order.status === 'completed' ? 'Заказ завершен' : order.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{order.final_price} BYN</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">У вас пока нет заказов</p>
        )}
      </div>

      <a
        href="/dashboard/customer/create-order"
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
      >
        Создать новый заказ
      </a>
    </div>
  )
}
