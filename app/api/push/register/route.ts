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
    if (!bodyResult.ok) return apiError('Браузер передал неполную подписку. Отключите уведомления для сайта и включите снова.', 400, 'PUSH_INVALID_SUBSCRIPTION')
    const { subscription } = bodyResult.data
    if (!isTrustedPushEndpoint(subscription.endpoint)) {
      let host = 'invalid-url'
      try { host = new URL(subscription.endpoint).hostname.slice(0, 253) } catch {}
      console.warn('Push provider rejected:', host)
      return apiError('Служба уведомлений этого браузера пока не поддерживается. Откройте сайт в Safari, Chrome или Firefox.', 400, 'PUSH_UNSUPPORTED_PROVIDER')
    }

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
      console.error('Push subscription save failed:', error.code)
      return apiError('Не удалось сохранить подписку. Попробуйте ещё раз.', 500, 'PUSH_SAVE_FAILED')
    }

    return apiSuccess()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    console.error('Ошибка регистрации push-подписки:', error)
    return apiError(maskInternalMessage(message), 500)
  }
}

