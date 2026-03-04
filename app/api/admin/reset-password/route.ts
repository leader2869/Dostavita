import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/api/auth'
import { apiError, apiSuccess, maskInternalMessage } from '@/lib/api/response'
import { parseBody } from '@/lib/api/validate'
import { adminResetPasswordSchema } from '@/lib/api/validate'
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from '@/lib/config'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const bodyResult = await parseBody(request, adminResetPasswordSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { email } = bodyResult.data

    const auth = await requireSuperadmin(supabase)
    if (!auth.ok) return auth.response

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return apiError('Ошибка конфигурации сервера (Supabase env)', 500)
    }

    // Создаем клиент с service role key для доступа к admin API
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Генерируем ссылку для сброса пароля
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    })

    if (error) {
      console.error('Ошибка при генерации ссылки для сброса пароля:', error)
      return apiError(maskInternalMessage(error.message) || 'Ошибка при сбросе пароля', 500)
    }

    if (data?.properties?.action_link) {
      return apiSuccess({
        resetLink: data.properties.action_link,
        message: 'Ссылка для сброса пароля успешно сгенерирована',
      })
    }
    return apiError('Ссылка для сброса пароля не была сгенерирована', 500)
  } catch (error: any) {
    console.error('Ошибка в API reset-password:', error)
    return apiError(maskInternalMessage(error?.message) || 'Внутренняя ошибка сервера', 500)
  }
}

