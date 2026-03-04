import { NextResponse } from 'next/server'

/**
 * Проверка: видит ли сервер переменные Supabase (только факт, без значений).
 * Вызов: GET /api/env-check
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const urlSet = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())
  const anonSet = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim())
  return NextResponse.json({
    ok: urlSet && anonSet,
    NEXT_PUBLIC_SUPABASE_URL_set: urlSet,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_set: anonSet,
    hint: !urlSet || !anonSet
      ? 'Задайте переменные в .env.local в корне проекта, затем удалите папку .next и перезапустите: npm run dev'
      : undefined,
  })
}
