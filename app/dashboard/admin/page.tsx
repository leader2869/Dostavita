import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'

export default async function AdminDashboard() {
  const supabase = createServerSupabaseClient()
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Используем RPC функцию для получения профиля (обходит RLS)
  let { data: profile, error: profileError } = await supabase
    .rpc('get_user_profile', { user_id: user.id })
    .single()
  
  // Fallback на прямой запрос
  if (profileError || !profile) {
    const { data: directProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    
    if (directProfile) {
      profile = directProfile as User
    }
  }

  if (!profile || ((profile as User).role !== 'admin' && (profile as User).role !== 'superadmin')) {
    redirect('/dashboard')
  }

  // Получаем статистику через RPC функцию (обходит RLS)
  const { data: stats, error: statsError } = await supabase
    .rpc('get_admin_stats')
    .single()
  
  // Fallback на прямые запросы, если RPC не работает
  let usersCount = (stats as { users_count?: number } | null)?.users_count || 0
  let driversCount = (stats as { drivers_count?: number } | null)?.drivers_count || 0
  let ordersCount = (stats as { orders_count?: number } | null)?.orders_count || 0
  
  if (statsError || !stats) {
    console.log('AdminDashboard - RPC не сработал, пробуем прямые запросы...')
    
    const { count: ordersCountDirect } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
    
    const { count: usersCountDirect } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    
    const { count: driversCountDirect } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
    
    if (ordersCountDirect !== null) ordersCount = ordersCountDirect
    if (usersCountDirect !== null) usersCount = usersCountDirect
    if (driversCountDirect !== null) driversCount = driversCountDirect
  }
  
  console.log('AdminDashboard - Статистика:', {
    users: usersCount,
    drivers: driversCount,
    orders: ordersCount,
    error: statsError?.message
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">
        Панель администратора
        {(profile as User).role === 'superadmin' && ' (Суперадмин)'}
      </h1>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Всего заказов</h2>
          <p className="text-3xl font-bold">{ordersCount || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Пользователей</h2>
          <p className="text-3xl font-bold">{usersCount || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Водителей</h2>
          <p className="text-3xl font-bold">{driversCount || 0}</p>
        </div>
      </div>

      {/* Навигация */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <a
          href="/dashboard/admin/orders"
          className="bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
        >
          <h3 className="font-semibold mb-2">Управление заказами</h3>
          <p className="text-sm text-gray-300">Просмотр и управление всеми заказами</p>
        </a>

        <a
          href="/dashboard/admin/users"
          className="bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
        >
          <h3 className="font-semibold mb-2">Управление пользователями</h3>
          <p className="text-sm text-gray-300">Просмотр и редактирование пользователей</p>
        </a>

        <a
          href="/dashboard/admin/personnel"
          className="bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
        >
          <h3 className="font-semibold mb-2">Управление персоналом</h3>
          <p className="text-sm text-gray-300">Управление водителями и автопарками</p>
        </a>

        {(profile as User).role === 'superadmin' && (
          <a
            href="/dashboard/admin/tariffs"
            className="bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition"
          >
            <h3 className="font-semibold mb-2">Управление тарифами</h3>
            <p className="text-sm text-gray-300">Настройка регионов и цен</p>
          </a>
        )}
      </div>
    </div>
  )
}

