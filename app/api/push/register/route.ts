import { isTrustedPushEndpoint } from '@/lib/push-endpoint'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { pushRegisterSchema } from '@/lib/api/validate'
import { apiSuccess, apiError, maskInternalMessage } from '@/lib/api/response'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const auth = await getAuthUser(supabase)
    if (!auth.ok) return auth.response
    const { user } = auth

    const bodyResult = await parseBody(request, pushRegisterSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { subscription } = bodyResult.data
    if (!isTrustedPushEndpoint(subscription.endpoint)) return apiError('Недопустимый push-провайдер', 400)

    // Atomic per-device upsert. RLS never transfers another account's endpoint.
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })
    if (error) {
      if (error.code === '42501' || error.code === '23505') {
        return apiError('Подписка принадлежит другой сессии. Включите уведомления заново.', 409)
      }
      return apiError('Не удалось сохранить подписку. Попробуйте ещё раз.', 500)
    }

    return apiSuccess()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    console.error('Ошибка регистрации push-подписки:', error)
    return apiError(maskInternalMessage(message), 500)
  }
}

