import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { pushRegisterSchema } from '@/lib/api/validate'
import { apiSuccess, apiError, maskInternalMessage } from '@/lib/api/response'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const auth = await getAuthUser(supabase)
    if (!auth.ok) return auth.response
    const { user } = auth

    const bodyResult = await parseBody(request, pushRegisterSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { subscription } = bodyResult.data

    // Сохраняем подписку в базе данных
    // Проверяем, существует ли уже подписка для этого пользователя и endpoint
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('endpoint', subscription.endpoint)
      .maybeSingle()

    if (fetchError) {
      console.error('Ошибка получения существующей подписки:', fetchError)
      return apiError(maskInternalMessage(fetchError.message), 500)
    }

    if (existingSubscription) {
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSubscription.id)

      if (updateError) {
        console.error('Ошибка обновления push-подписки:', updateError)
        return apiError(maskInternalMessage(updateError.message), 500)
      }
    } else {
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
        })

      if (insertError) {
        console.error('Ошибка сохранения push-подписки:', insertError)
        return apiError(maskInternalMessage(insertError.message), 500)
      }
    }

    return apiSuccess()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    console.error('Ошибка регистрации push-подписки:', error)
    return apiError(maskInternalMessage(message), 500)
  }
}

