import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api/auth'
import { apiSuccess, apiError, maskInternalMessage } from '@/lib/api/response'

export async function POST() {
  try {
    const supabase = createServerSupabaseClient()
    const auth = await getAuthUser(supabase)
    if (!auth.ok) return auth.response
    const user = auth.user

    // Проверяем, существует ли профиль
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfile) {
      return apiError('Профиль уже существует', 400)
    }

    // Создаем профиль через серверный клиент (обходит RLS)
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email ?? '',
        full_name: null,
        phone: null,
        role: 'client',
      })
      .select()
      .single()

    if (createError) {
      console.error('Ошибка создания профиля:', createError)
      return apiError(maskInternalMessage(createError.message), 500)
    }

    return apiSuccess({ profile: newProfile })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    console.error('Ошибка API:', error)
    return apiError(maskInternalMessage(message), 500)
  }
}






