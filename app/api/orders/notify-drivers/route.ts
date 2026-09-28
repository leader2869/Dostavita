import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/api/auth'
import { parseBody, notifyDriversSchema } from '@/lib/api/validate'
import { apiSuccess, apiError } from '@/lib/api/response'
import { configurePush, sendPush } from '@/lib/push'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const auth = await requireRole(supabase, ['customer', 'client'])
    if (!auth.ok) return auth.response
    const body = await parseBody(request, notifyDriversSchema)
    if (!body.ok) return body.response

    // RLS может разрешать чтение чужих публичных заказов: проверяем создателя отдельно.
    const { data: order, error } = await supabase.from('orders')
      .select('id, customer_id, order_number, final_price, status, visibility')
      .eq('id', body.data.orderId).single()
    if (error || !order) return apiError('Заказ не найден', 404)
    if (order.customer_id !== auth.user.id) return apiError('Доступ запрещен', 403)
    if (order.status !== 'searching_courier' || order.visibility !== 'public') {
      return apiError('Заказ недоступен для общей рассылки', 400)
    }
    if (!configurePush()) return apiError('Push-уведомления не настроены', 503)

    // Привилегированный клиент нужен только для подписок и отказов, после проверки заказа.
    const admin = createAdminSupabaseClient()
    const { data: subscriptions, error: subsError } = await admin.from('push_subscriptions')
      .select('user_id, endpoint, p256dh_key, auth_key, profiles!inner(role)')
      .eq('profiles.role', 'driver')
    if (subsError) throw subsError
    const { data: rejections, error: rejectionError } = await admin.from('order_rejections')
      .select('driver_user_id').eq('order_id', order.id)
    if (rejectionError) throw rejectionError
    const rejected = new Set(rejections?.map((r) => r.driver_user_id))
    const recipients = (subscriptions ?? []).filter((s) => !rejected.has(s.user_id))
    return apiSuccess(await sendPush(admin, recipients, {
      title: 'Новый заказ!',
      body: `Заказ №${order.order_number || order.id.slice(0, 8)} - ${order.final_price} BYN`,
      tag: `order-${order.id}`,
      data: { orderId: order.id, url: '/dashboard/driver' },
    }))
  } catch {
    console.error('Ошибка рассылки уведомлений о заказе')
    return apiError('Не удалось отправить уведомления', 500)
  }
}
