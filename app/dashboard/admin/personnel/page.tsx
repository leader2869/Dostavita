import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/BackButton'
import type { User } from '@/lib/types'
import { getCachedUserAndProfile } from '@/lib/supabase/cached-auth'

export default async function AdminPersonnelPage() {
  const supabase = await createServerSupabaseClient()
  const { user, profile, authError } = await getCachedUserAndProfile()

  if (authError || !user) redirect('/login')
  if (!profile) redirect('/login')
  const role = (profile as User).role
  if (role !== 'admin' && role !== 'superadmin') redirect('/dashboard')

  // Driver accounts and vehicle details live in profiles, not the legacy drivers table.
  // This query uses the caller's session and retains the database's RLS checks.
  const { data: drivers, error: driversError } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, vehicle_type, vehicle_brand, vehicle_model, vehicle_number, organization_id')
    .eq('role', 'driver')
    .order('created_at', { ascending: false })

  const organizationIds = Array.from(new Set((drivers || []).map(driver => driver.organization_id).filter(Boolean)))
  const organizations = organizationIds.length ? await supabase.from('profiles')
    .select('id, organization_name, full_name, email').in('id', organizationIds) : { data: [], error: null }
  const companyNames = new Map((organizations.data || []).map(company => [company.id, company.organization_name || company.full_name || company.email]))

  const vehicleLabels: Record<string, string> = {
    car: 'Автомобиль', motorcycle: 'Мотоцикл', bicycle: 'Велосипед', walking: 'Пешком',
  }

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Управление персоналом</h1>

      {driversError && (
        <div role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-800">
          Не удалось загрузить персонал. Обновите страницу, чтобы повторить попытку.
        </div>
      )}
      <div className="bg-gray-50 rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Водитель</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Транспорт</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Номер</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Организация</th>
            </tr>
          </thead>
          <tbody className="bg-gray-50 divide-y divide-gray-700">
            {drivers && drivers.length > 0 ? (
              drivers.map((driver) => (
                <tr key={driver.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{driver.full_name || driver.email}</p>
                      <p className="text-xs text-gray-600">{driver.email}</p>
                      <p className="text-xs text-gray-600">{driver.phone || '-'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {[vehicleLabels[driver.vehicle_type] || driver.vehicle_type, driver.vehicle_brand, driver.vehicle_model].filter(Boolean).join(' ') || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {driver.vehicle_number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {!driver.organization_id ? 'Не привязан' : organizations.error ? 'Ошибка загрузки компании' : companyNames.get(driver.organization_id) || 'Компания недоступна'}
                    {role === 'superadmin' && <Link href={`/dashboard/admin/users/${driver.id}`} className="mt-2 block text-sky-700 underline">Карточка и баланс</Link>}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-600">
                  {driversError ? 'Список персонала недоступен' : 'Нет водителей'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
