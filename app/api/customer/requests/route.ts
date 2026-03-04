import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth'

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const auth = await requireRole(supabase, 'customer')
    if (!auth.ok) return auth.response
    const { user } = auth

    // Получаем запросы организации через RPC функцию
    const { data: requests, error: requestsError } = await supabase
      .rpc('get_organization_requests', { organization_user_id: user.id })

    if (requestsError) {
      console.error('Ошибка получения запросов:', requestsError)
      return NextResponse.json(
        { error: requestsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ requests: requests || [] })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

