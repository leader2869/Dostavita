import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'

export default async function FleetDashboard() {
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

  if (!profile || (profile as User).role !== 'fleet') {
    redirect('/dashboard')
  }

  // Получаем автопарк
  const { data: fleet } = await supabase
    .from('fleets')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Получаем водителей автопарка
  const { data: drivers } = await supabase
    .from('drivers')
    .select(`
      *,
      profiles:user_id (
        email,
        full_name,
        phone
      )
    `)
    .eq('fleet_id', fleet?.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Панель автопарка</h1>

      {fleet && (
        <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">{fleet.name}</h2>
          <p className="text-gray-700 mb-2">{fleet.description || 'Нет описания'}</p>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-sm text-gray-600">Водителей</p>
              <p className="text-2xl font-bold">{fleet.total_drivers}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Заказов</p>
              <p className="text-2xl font-bold">{fleet.total_orders}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Рейтинг</p>
              <p className="text-2xl font-bold">{fleet.rating.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Водители автопарка</h2>
        {drivers && drivers.length > 0 ? (
          <div className="space-y-4">
            {drivers.map((driver: any) => (
              <div key={driver.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{driver.profiles?.full_name || driver.profiles?.email}</p>
                    <p className="text-sm text-gray-700">{driver.profiles?.phone || '-'}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {driver.vehicle_type} {driver.vehicle_number ? `- ${driver.vehicle_number}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Заказов: {driver.total_orders}</p>
                    <p className="text-sm text-gray-600">Рейтинг: {driver.rating.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">Нет водителей в автопарке</p>
        )}
      </div>
    </div>
  )
}

