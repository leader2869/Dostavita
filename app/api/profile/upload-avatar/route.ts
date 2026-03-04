import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/api/auth'
import { apiSuccess, apiError, maskInternalMessage } from '@/lib/api/response'
import { MAX_AVATAR_SIZE_BYTES } from '@/lib/constants'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const auth = await getAuthUser(supabase)
    if (!auth.ok) return auth.response
    const user = auth.user

    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file) {
      return apiError('Файл не найден', 400)
    }
    if (!file.type.startsWith('image/')) {
      return apiError('Файл должен быть изображением', 400)
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return apiError('Размер файла не должен превышать 5MB', 400)
    }

    // Bucket должен быть создан вручную в Supabase Dashboard
    // Storage -> Create bucket: название "avatars", публичный: Да

    // Генерируем уникальное имя файла
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    // Загружаем файл в Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('Ошибка загрузки файла:', uploadError)
      return apiError(maskInternalMessage(uploadError.message), 500)
    }

    // Получаем публичный URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const avatarUrl = urlData.publicUrl

    // Обновляем профиль с URL аватара
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)

    if (updateError) {
      console.error('Ошибка обновления профиля:', updateError)
      return apiError(maskInternalMessage(updateError.message), 500)
    }

    return apiSuccess({ avatar_url: avatarUrl })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    console.error('Ошибка API:', error)
    return apiError(maskInternalMessage(message), 500)
  }
}

