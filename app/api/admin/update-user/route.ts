import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { adminUpdateUserSchema } from '@/lib/api/validate'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const bodyResult = await parseBody(request, adminUpdateUserSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { userId, fullName, phone, role, email } = bodyResult.data

    const auth = await requireSuperadmin(supabase)
    if (!auth.ok) return auth.response

    // Обновляем профиль
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName ?? null,
        phone: phone ?? null,
        role: role ?? 'client',
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Ошибка обновления профиля:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Если изменился email, обновляем его в auth.users
    if (email) {
      const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
        email: email,
      })

      if (emailError) {
        console.error('Ошибка обновления email:', emailError)
        // Не возвращаем ошибку, так как профиль уже обновлен
      }
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






