import { NextResponse } from 'next/server'

/**
 * Отдаёт публичные ключи Supabase для инициализации клиента в браузере.
 * Anon key предназначен для использования на клиенте; URL и ключ не секретны.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }
  return NextResponse.json({ url, anonKey })
}
