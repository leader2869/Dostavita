import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import type { User } from '@/lib/types'
import { getCachedUserAndProfile } from '@/lib/supabase/cached-auth'

export default async function AdminPersonnelPage() {
  const supabase = createServerSupabaseClient()
  const { user, profile, authError } = await getCachedUserAndProfile()

  if (authError || !user) redirect('/login')
  if (!profile) redirect('/login')
  const role = (profile as User).role
  if (role !== 'admin' && role !== 'superadmin') redirect('/dashboard')

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
  
  if (driversError || !drivers) {
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

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Управление персоналом</h1>

      <div className="bg-gray-50 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Водитель</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Транспорт</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Номер</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Статус</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Заказов</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Рейтинг</th>
            </tr>
          </thead>
          <tbody className="bg-gray-50 divide-y divide-gray-700">
            {drivers && drivers.length > 0 ? (
              drivers.map((driver: any) => (
                <tr key={driver.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{driver.profiles?.full_name || driver.profiles?.email}</p>
                      <p className="text-xs text-gray-600">{driver.profiles?.phone || '-'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {driver.vehicle_type === 'car' && 'Автомобиль'}
                    {driver.vehicle_type === 'motorcycle' && 'Мотоцикл'}
                    {driver.vehicle_type === 'bicycle' && 'Велосипед'}
                    {driver.vehicle_type === 'walking' && 'Пешком'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {driver.vehicle_number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      driver.shift_status === 'online' ? 'bg-brand-light text-gray-900' :
                      driver.shift_status === 'offline' ? 'bg-gray-100 text-gray-900' :
                      'bg-yellow-600 text-gray-900'
                    }`}>
                      {driver.shift_status === 'online' && 'Онлайн'}
                      {driver.shift_status === 'offline' && 'Офлайн'}
                      {driver.shift_status === 'break' && 'Перерыв'}
                      {driver.shift_status === 'shift_closed' && 'Смена закрыта'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {driver.total_orders}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {driver.rating.toFixed(2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-600">
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
