import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import type { User } from '@/lib/types'
import { getCachedUserAndProfile } from '@/lib/supabase/cached-auth'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { ExportOrdersButton } from '@/components/ExportOrdersButton'

export default async function AdminOrdersPage() {
  const supabase = createServerSupabaseClient()
  const { user, profile, authError } = await getCachedUserAndProfile()

  if (authError || !user) redirect('/login')
  if (!profile) redirect('/login')
  const role = (profile as User).role
  if (role !== 'admin' && role !== 'superadmin') redirect('/dashboard')

  // Получаем все заказы через RPC функцию (обходит RLS)
  let { data: orders, error: ordersError } = await supabase
    .rpc('get_all_orders_for_admin', { limit_count: 100 })
  
  if (ordersError || !orders) {
    const { data: directOrders } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (directOrders) {
      orders = directOrders
    }
  }

  return (
    <div>
      <BackButton />
      <div className="flex justify-between items-center mb-6">
        <ExportOrdersButton orders={orders || []} filename="Все_заказы" />
      </div>

      <div className="bg-gray-50 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Откуда</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Куда</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Статус</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Стоимость</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Дата</th>
            </tr>
          </thead>
          <tbody className="bg-gray-50 divide-y divide-gray-700">
            {orders && orders.length > 0 ? (
              orders.map((order: any) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {order.order_number || order.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatAddressForOrder(order.pickup_address)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatAddressForOrder(order.delivery_address)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.status === 'searching_courier' && 'Ищем курьера'}
                    {order.status === 'courier_accepted' && 'Курьер принял заказ'}
                    {order.status === 'courier_coming' && 'Курьер едет к отправителю'}
                    {order.status === 'courier_delivering' && 'Курьер едет к получателю'}
                    {order.status === 'completed' && 'Заказ завершен'}
                    {order.status === 'cancelled' && 'Отменен'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {order.final_price} BYN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
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
                <td colSpan={6} className="px-6 py-4 text-center text-gray-600">
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
