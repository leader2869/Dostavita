import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types'
import { DashboardNav } from '@/components/navigation/DashboardNav'
import { PageTitle } from '@/components/navigation/PageTitle'
import { DriverLayoutWrapper } from '@/components/driver/DriverLayoutWrapper'
import { BottomNavigationWrapper } from '@/components/navigation/BottomNavigationWrapper'

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
  
  let user, authError
  const maxRetries = 3
  let lastError: any = null
  
  // Пробуем подключиться с повторными попытками
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error
      
      // Если получили пользователя или ошибка не связана с сетью, выходим из цикла
      if (user || (authError && !authError.message?.includes('fetch failed') && !authError.message?.includes('timeout'))) {
        break
      }
      
      // Если это ошибка сети и не последняя попытка, ждем и пробуем снова
      if (authError && (authError.message?.includes('fetch failed') || authError.message?.includes('timeout'))) {
        lastError = authError
        if (attempt < maxRetries) {
          console.log(`⚠️ Dashboard Layout - Попытка ${attempt}/${maxRetries} не удалась, повтор через 1 секунду...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }
      }
    } catch (err: any) {
      console.error(`❌ Dashboard Layout - Исключение при getUser() (попытка ${attempt}/${maxRetries}):`, err)
      lastError = err
      
      // Если это ошибка сети и не последняя попытка, ждем и пробуем снова
      if ((err.message?.includes('fetch failed') || err.message?.includes('timeout')) && attempt < maxRetries) {
        console.log(`⚠️ Dashboard Layout - Ошибка сети, повтор через 1 секунду...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      
      // Если это не ошибка сети или последняя попытка, выходим
      if (!err.message?.includes('fetch failed') && !err.message?.includes('timeout')) {
        throw err
      }
      
      authError = err
    }
  }
  
  // Если все попытки не удались, используем последнюю ошибку
  if (!user && lastError && !authError) {
    authError = lastError
  }
  
  if (authError && (authError.message?.includes('fetch failed') || authError.message?.includes('timeout'))) {
    console.log('⚠️ Dashboard Layout - Ошибка сети при подключении к Supabase после всех попыток')
    console.log('Проверьте переменные окружения NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.log('Текущий URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  }

  console.log('Dashboard Layout - Результат getUser():', { 
    hasUser: !!user, 
    userId: user?.id,
    email: user?.email,
    error: authError?.message,
    errorCode: authError?.status 
  })

  if (authError) {
    console.error('❌ Dashboard Layout - Ошибка getUser():', authError)
    // Если это ошибка сети, не редиректим сразу - даем пользователю шанс
    if (authError.message?.includes('fetch failed') || authError.message?.includes('timeout')) {
      console.log('⚠️ Dashboard Layout - Проблема с подключением к Supabase')
      console.log('Проверьте интернет-соединение и настройки Supabase')
    }
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

  const isDriver = (profile as User).role === 'driver'

  return (
    <DriverLayoutWrapper>
      <div className="min-h-screen bg-white relative">
        <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-4xl font-bold text-brand-light font-amatic-sc">Просто!</h1>
                <PageTitle />
              </div>
              <DashboardNav profile={profile as User} userId={user.id} />
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 pb-10">
          {children}
        </main>
      </div>
      {/* Нижняя навигация - закреплена для всех страниц, вне основного контейнера */}
      <BottomNavigationWrapper role={(profile as User).role} />
    </DriverLayoutWrapper>
  )
}
