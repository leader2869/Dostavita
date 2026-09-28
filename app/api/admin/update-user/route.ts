import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { adminUpdateUserSchema } from '@/lib/api/validate'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const bodyResult = await parseBody(request, adminUpdateUserSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { userId, fullName, phone, role, email } = bodyResult.data

    const auth = await requireSuperadmin(supabase)
    if (!auth.ok) return auth.response

    const admin = createAdminSupabaseClient()
    const patch: Record<string, string | null> = {}
    if (fullName !== undefined) patch.full_name = fullName
    if (phone !== undefined) patch.phone = phone
    if (role !== undefined) patch.role = role

    // Never report success when Auth rejects the email change.
    if (email !== undefined) {
      const { error } = await admin.auth.admin.updateUserById(userId, { email })
      if (error) return NextResponse.json({ error: 'Не удалось изменить email' }, { status: 500 })
      patch.email = email
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from('profiles').update(patch).eq('id', userId)
      if (error) return NextResponse.json({ error: 'Не удалось обновить профиль' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}






