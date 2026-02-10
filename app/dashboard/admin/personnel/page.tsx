import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import type { User } from '@/lib/types'

export default async function AdminPersonnelPage() {
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

  // Получаем всех водителей через RPC функцию (обходит RLS)
  let { data: drivers, error: driversError } = await supabase
    .rpc('get_all_drivers')
    .limit(100)
  
  // Преобразуем данные из RPC функции в формат с вложенным profiles
  const driversWithProfiles = drivers?.map((d: any) => ({
    ...d,
    profiles: {
      email: d.profile_email,
      full_name: d.profile_full_name,
      phone: d.profile_phone
    }
  }))
  
  // Fallback на прямой запрос, если RPC не работает
  if (driversError || !drivers) {
    console.log('AdminPersonnelPage - RPC не сработал, пробуем прямой запрос...')
    const { data: directDrivers } = await supabase
      .from('drivers')
      .select(`
        *,
        profiles:user_id (
          email,
          full_name,
          phone
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (directDrivers) {
      drivers = directDrivers
    } else {
      drivers = driversWithProfiles
    }
  } else {
    drivers = driversWithProfiles
  }
  
  console.log('AdminPersonnelPage - Водителей загружено:', drivers?.length || 0)

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Управление персоналом</h1>

      <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Водитель</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Транспорт</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Номер</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Статус</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Заказов</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Рейтинг</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-200">
            {drivers && drivers.length > 0 ? (
              drivers.map((driver: any) => (
                <tr key={driver.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>
                      <p className="font-medium">{driver.profiles?.full_name || driver.profiles?.email}</p>
                      <p className="text-xs text-gray-400">{driver.profiles?.phone || '-'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {driver.vehicle_type === 'car' && 'Автомобиль'}
                    {driver.vehicle_type === 'motorcycle' && 'Мотоцикл'}
                    {driver.vehicle_type === 'bicycle' && 'Велосипед'}
                    {driver.vehicle_type === 'walking' && 'Пешком'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {driver.vehicle_number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      driver.shift_status === 'online' ? 'bg-green-100 text-green-800' :
                      driver.shift_status === 'offline' ? 'bg-gray-700 text-gray-200' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {driver.shift_status === 'online' && 'Онлайн'}
                      {driver.shift_status === 'offline' && 'Офлайн'}
                      {driver.shift_status === 'break' && 'Перерыв'}
                      {driver.shift_status === 'shift_closed' && 'Смена закрыта'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {driver.total_orders}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {driver.rating.toFixed(2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-400">
                  Нет водителей
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
