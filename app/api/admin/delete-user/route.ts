import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { adminDeleteUserSchema } from '@/lib/api/validate'
import { apiSuccess, apiError, maskInternalMessage } from '@/lib/api/response'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const bodyResult = await parseBody(request, adminDeleteUserSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { userId } = bodyResult.data

    const auth = await requireSuperadmin(supabase)
    if (!auth.ok) return auth.response
    const { user } = auth

    if (userId === user.id) return apiError('Нельзя удалить самого себя', 400)

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Ошибка удаления пользователя:', deleteError)
      return apiError(maskInternalMessage(deleteError.message), 500)
    }

    return apiSuccess()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    console.error('Ошибка API:', error)
    return apiError(maskInternalMessage(message), 500)
  }
}






