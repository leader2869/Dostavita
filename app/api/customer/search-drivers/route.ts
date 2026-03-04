import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { searchDriversSchema } from '@/lib/api/validate'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const bodyResult = await parseBody(request, searchDriversSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { search } = bodyResult.data

    const auth = await requireRole(supabase, 'customer')
    if (!auth.ok) return auth.response
    const { user } = auth

    const { data: drivers, error: driversError } = await supabase
      .rpc('search_available_drivers', {
        search_term: search?.trim() || null,
      })

    if (driversError) {
      console.error('Ошибка поиска водителей:', driversError)
      return NextResponse.json(
        { error: driversError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ drivers: drivers || [] })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

