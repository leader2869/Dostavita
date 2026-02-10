import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ClientDashboard() {
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
      profile = directProfile
    }
  }

  if (!profile || profile.role !== 'client') {
    redirect('/dashboard')
  }

  // Получаем заказы, где пользователь указан как получатель
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Мои заказы (как получатель)</h1>

      <div className="bg-white rounded-lg shadow p-6">
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
          <p className="text-gray-500">У вас пока нет заказов, где вы указаны как получатель</p>
        )}
      </div>
    </div>
  )
}

