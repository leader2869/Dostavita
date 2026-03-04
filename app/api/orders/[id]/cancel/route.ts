import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api/auth'
import { paramsIdSchema } from '@/lib/api/validate'
import { apiSuccess, apiError, maskInternalMessage } from '@/lib/api/response'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const parsed = paramsIdSchema.safeParse(params)
    if (!parsed.success) return apiError('ID заказа обязателен', 400)
    const orderId = parsed.data.id

    const auth = await requireRole(supabase, ['customer', 'client'])
    if (!auth.ok) return auth.response
    const { user } = auth

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, customer_id, client_id, executor_user_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) return apiError('Заказ не найден', 404)
    if (order.status !== 'searching_courier') {
      return apiError('Можно отменить только заказ в статусе «Ищем курьера»', 400)
    }
    if (order.executor_user_id) {
      return apiError('Заказ уже принят водителем, отмена невозможна', 400)
    }

    const userRole = auth.profile.role
    const hasAccess =
      (userRole === 'client' && order.client_id === user.id) ||
      (userRole === 'customer' && order.customer_id === user.id)
    if (!hasAccess) return apiError('Нет прав для отмены этого заказа', 403)

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Ошибка отмены заказа:', updateError)
      return apiError(maskInternalMessage(updateError.message), 500)
    }

    return apiSuccess({ message: 'Заказ успешно отменен' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    console.error('Ошибка API:', error)
    return apiError(maskInternalMessage(message), 500)
  }
}

