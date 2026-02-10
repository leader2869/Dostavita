import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  
  console.log('Dashboard Page - Начало проверки...')
  
  let user, authError
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
    authError = result.error
  } catch (err: any) {
    console.error('❌ Dashboard Page - Исключение при getUser():', err)
    if (err.message?.includes('fetch failed') || err.message?.includes('timeout')) {
      console.log('⚠️ Dashboard Page - Ошибка сети при подключении к Supabase')
      console.log('Проверьте переменные окружения NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY')
      authError = err
    } else {
      throw err
    }
  }

  console.log('Dashboard Page - getUser():', { hasUser: !!user, userId: user?.id, error: authError?.message })

  if (authError || !user) {
    console.log('Dashboard Page - Редирект на /login (нет пользователя)')
    redirect('/login')
  }

  // Получаем профиль пользователя через RPC функцию (обходит RLS)
  let { data: profile, error: profileError } = await supabase
    .rpc('get_user_profile', { user_id: user.id })
    .single()
  
  // Fallback на прямой запрос, если RPC не работает
  if (profileError || !profile) {
    const { data: directProfile, error: directError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    
    if (directProfile && !directError) {
      profile = directProfile
      profileError = null
    }
  }

  console.log('Dashboard Page - Профиль:', { hasProfile: !!profile, role: (profile as User | null)?.role, error: profileError?.message })

  if (profileError || !profile) {
    console.log('Dashboard Page - Редирект на /login (нет профиля)')
    redirect('/login')
  }

  const userProfile = profile as User

  // Редиректим в зависимости от роли
  // Все возможные роли: customer, client, driver, fleet, admin, superadmin
  console.log('Dashboard Page - Редирект на:', `/dashboard/${userProfile.role}`)
  
  const roleRoutes: Record<string, string> = {
    customer: '/dashboard/customer',
    client: '/dashboard/client',
    driver: '/dashboard/driver',
    fleet: '/dashboard/fleet',
    admin: '/dashboard/admin',
    superadmin: '/dashboard/admin',
  }
  
  const route = roleRoutes[userProfile.role]
  
  if (route) {
    redirect(route)
  } else {
    // Если роль неизвестна, логируем и редиректим на customer по умолчанию
    console.warn(`Dashboard Page - Неизвестная роль: ${userProfile.role}, редирект на /dashboard/customer`)
    redirect('/dashboard/customer')
  }
}
