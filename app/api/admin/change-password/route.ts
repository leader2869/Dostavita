import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { requireSuperadmin } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'

const schema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(12, 'Минимум 12 символов').max(128, 'Максимум 128 символов'),
})

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Недопустимый источник запроса' }, { status: 403 })
    }
    const auth = await requireSuperadmin(await createServerSupabaseClient())
    if (!auth.ok) return auth.response
    const body = await parseBody(request, schema)
    if (!body.ok) return body.response
    const admin = createAdminSupabaseClient()
    const { error } = await admin.auth.admin.updateUserById(body.data.userId, { password: body.data.password })
    if (error) {
      return NextResponse.json({ error: 'Не удалось изменить пароль. Проверьте пользователя и требования к паролю.' }, { status: 400 })
    }
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Сервис смены пароля недоступен' }, { status: 500 })
  }
}
