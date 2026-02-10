import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  
  console.log('Dashboard Page - Начало проверки...')
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

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

  console.log('Dashboard Page - Профиль:', { hasProfile: !!profile, role: profile?.role, error: profileError?.message })

  if (profileError || !profile) {
    console.log('Dashboard Page - Редирект на /login (нет профиля)')
    redirect('/login')
  }

  // Редиректим в зависимости от роли
  // Все возможные роли: customer, client, driver, fleet, admin, superadmin
  console.log('Dashboard Page - Редирект на:', `/dashboard/${profile.role}`)
  
  const roleRoutes: Record<string, string> = {
    customer: '/dashboard/customer',
    client: '/dashboard/client',
    driver: '/dashboard/driver',
    fleet: '/dashboard/fleet',
    admin: '/dashboard/admin',
    superadmin: '/dashboard/admin',
  }
  
  const route = roleRoutes[profile.role]
  
  if (route) {
    redirect(route)
  } else {
    // Если роль неизвестна, логируем и редиректим на customer по умолчанию
    console.warn(`Dashboard Page - Неизвестная роль: ${profile.role}, редирект на /dashboard/customer`)
    redirect('/dashboard/customer')
  }
}
