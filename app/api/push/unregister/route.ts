import { parseBody, pushUnregisterSchema } from '@/lib/api/validate'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api/auth'
import { apiSuccess, apiError, maskInternalMessage } from '@/lib/api/response'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const auth = await getAuthUser(supabase)
    if (!auth.ok) return auth.response

    const body = await parseBody(request, pushUnregisterSchema)
    if (!body.ok) return body.response

    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('endpoint', body.data.endpoint)

    if (deleteError) {
      console.error('Ошибка удаления push-подписки:', deleteError)
      return apiError(maskInternalMessage(deleteError.message), 500)
    }

    return apiSuccess()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    console.error('Ошибка отписки от push-уведомлений:', error)
    return apiError(maskInternalMessage(message), 500)
  }
}

