import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  
  console.log('========================================')
  console.log('Dashboard Layout - Начало проверки аутентификации')
  console.log('========================================')
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  console.log('Dashboard Layout - Результат getUser():', { 
    hasUser: !!user, 
    userId: user?.id,
    email: user?.email,
    error: authError?.message,
    errorCode: authError?.status 
  })

  if (authError) {
    console.error('❌ Dashboard Layout - Ошибка getUser():', authError)
    console.log('Редирект на /login из-за ошибки аутентификации')
    redirect('/login')
  }

  if (!user) {
    console.log('❌ Dashboard Layout - Пользователь не найден')
    console.log('Редирект на /login - пользователь не найден')
    redirect('/login')
  }

  console.log('✅ Dashboard Layout - Пользователь аутентифицирован:', user.id)

  // Получаем профиль пользователя
  console.log('Dashboard Layout - Загружаем профиль пользователя...')
  
  // Используем RPC функцию для получения профиля, которая обходит RLS
  // Это решает проблему с auth.uid() = NULL на сервере
  let { data: profile, error: profileError } = await supabase
    .rpc('get_user_profile', { user_id: user.id })
    .single()
  
  // Если RPC не работает, пробуем прямой запрос (fallback)
  if (profileError || !profile) {
    console.log('Dashboard Layout - RPC не сработал, пробуем прямой запрос...')
    const { data: directProfile, error: directError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    
    if (directProfile && !directError) {
      profile = directProfile
      profileError = null
      console.log('Dashboard Layout - Прямой запрос успешен')
    } else {
      console.log('Dashboard Layout - Прямой запрос тоже не сработал:', directError?.message)
    }
  }

  console.log('Dashboard Layout - Результат загрузки профиля:', {
    hasProfile: !!profile,
    profileId: (profile as User | null)?.id,
    profileRole: (profile as User | null)?.role,
    error: profileError?.message
  })

  // Если профиль не найден, создаем его автоматически
  if (profileError && profileError.code === 'PGRST116') {
    console.log('⚠️ Dashboard Layout - Профиль не найден, создаем автоматически...')
    
    // Получаем роль из метаданных пользователя или используем 'client' по умолчанию
    const userRole = (user.user_metadata?.role as string) || 'client'
    
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || null,
        phone: user.user_metadata?.phone || null,
        role: userRole,
      })
      .select()
      .single()

    if (createError) {
      console.error('❌ Dashboard Layout - Ошибка создания профиля:', createError)
      console.log('Редирект на /login из-за ошибки создания профиля')
      redirect('/login')
    }

    // Создаем баланс, если его нет
    const { error: balanceError } = await supabase
      .from('balances')
      .upsert({
        user_id: user.id,
        amount: 0.00,
        currency: 'BYN',
      })

    if (balanceError) {
      console.error('⚠️ Dashboard Layout - Ошибка создания баланса (не критично):', balanceError)
    }

    profile = newProfile
    console.log('✅ Dashboard Layout - Профиль создан автоматически:', (profile as User | null)?.role)
  } else if (profileError) {
    console.error('❌ Dashboard Layout - Ошибка загрузки профиля:', profileError)
    console.log('Редирект на /login из-за ошибки загрузки профиля')
    redirect('/login')
  }

  if (!profile) {
    console.error('❌ Dashboard Layout - Профиль не найден после попытки создания')
    console.log('Редирект на /login - профиль не найден')
    redirect('/login')
  }

  console.log('✅ Dashboard Layout - Профиль загружен успешно:', (profile as User).role)
  console.log('========================================')

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">Dostavita</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {(profile as User).avatar_url ? (
                  <img
                    src={(profile as User).avatar_url}
                    alt="Аватар"
                    className="w-8 h-8 rounded-full object-cover border border-gray-600"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <span className="text-sm text-gray-300">
                  {(profile as User).full_name || (profile as User).email}
                </span>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Выйти
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
