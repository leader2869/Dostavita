import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import type { User } from '@/lib/types'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'

export default async function AdminOrdersPage() {
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

  // Получаем все заказы через RPC функцию (обходит RLS)
  let { data: orders, error: ordersError } = await supabase
    .rpc('get_all_orders_for_admin', { limit_count: 100 })
  
  // Fallback на прямой запрос, если RPC не работает
  if (ordersError || !orders) {
    console.log('AdminOrdersPage - RPC не сработал, пробуем прямой запрос...')
    const { data: directOrders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (directOrders) {
      orders = directOrders
    }
  }
  
  console.log('AdminOrdersPage - Заказов загружено:', orders?.length || 0)

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Управление заказами</h1>

      <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Откуда</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Куда</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Статус</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Стоимость</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Дата</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {orders && orders.length > 0 ? (
              orders.map((order: any) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {order.order_number || order.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4 text-sm text-white">
                    {formatAddressForOrder(order.pickup_address)}
                  </td>
                  <td className="px-6 py-4 text-sm text-white">
                    {formatAddressForOrder(order.delivery_address)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {order.status === 'searching_courier' && 'Ищем курьера'}
                    {order.status === 'courier_coming' && 'Курьер едет'}
                    {order.status === 'courier_delivering' && 'Доставляется'}
                    {order.status === 'completed' && 'Завершен'}
                    {order.status === 'cancelled' && 'Отменен'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white">
                    {order.final_price} BYN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {new Date(order.created_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-400">
                  Нет заказов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
