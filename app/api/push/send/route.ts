import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { apiError, apiSuccess } from '@/lib/api/response'
import { requireRole } from '@/lib/api/auth'
import { parseBody, pushSendSchema } from '@/lib/api/validate'
import { configurePush, sendPush } from '@/lib/push'

export async function POST(request: Request) {
  try {
    const auth = await requireRole(await createServerSupabaseClient(), ['admin', 'superadmin'])
    if (!auth.ok) return auth.response
    const body = await parseBody(request, pushSendSchema)
    if (!body.ok) return body.response
    if (!configurePush()) return apiError('Push-уведомления не настроены', 503)
    const { userId, title, body: message, data, tag } = body.data
    const admin = createAdminSupabaseClient()
    const { data: subscriptions, error } = await admin.from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key').eq('user_id', userId)
    if (error) throw error
    if (!subscriptions?.length) return apiError('У пользователя нет активных подписок', 404)
    return apiSuccess(await sendPush(admin, subscriptions, {
      title, body: message, data: data || {}, tag: tag || 'notification',
    }))
  } catch {
    console.error('Ошибка отправки push-уведомления')
    return apiError('Не удалось отправить уведомления', 500)
  }
}
