import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** Редирект в Next.js реализован через throw — не перехватывать, иначе сработает ErrorBoundary с usePathname. */
function isRedirectError(err: unknown): boolean {
  return typeof (err as any)?.digest === 'string' && (err as any).digest.startsWith('NEXT_REDIRECT')
}

export default async function Home() {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      redirect('/dashboard')
    }
    redirect('/login')
  } catch (error) {
    if (isRedirectError(error)) throw error
    if (process.env.NODE_ENV === 'development') {
      console.error('Ошибка при проверке пользователя:', error)
    }
    redirect('/login')
  }
}
