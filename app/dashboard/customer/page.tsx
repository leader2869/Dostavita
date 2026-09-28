import { CompanyOrderBoard } from '@/components/customer/CompanyOrderBoard'
import { loadCompanyOrderBoard } from '@/lib/company-order-board'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'
import { getCachedUserAndProfile } from '@/lib/supabase/cached-auth'

export default async function CustomerDashboard() {
  const supabase = await createServerSupabaseClient()
  const { user, profile, authError } = await getCachedUserAndProfile()

  if (authError || !user) redirect('/login')
  if (!profile || (profile as User).role !== 'customer') redirect('/dashboard')

  // Получаем водителей организации через RPC функцию
  const { data: drivers, error: driversError } = await supabase
    .rpc('get_organization_drivers', { organization_user_id: user.id })

  // Получаем балансы водителей
  const driverIds = drivers?.map((d: any) => d.id) || []
  let driverBalances: { [key: string]: { amount: number; currency: string } } = {}
  
  if (driverIds.length > 0) {
    const { data: balances } = await supabase
      .from('balances')
      .select('user_id, amount, currency')
      .in('user_id', driverIds)
    
    if (balances) {
      balances.forEach((b: any) => {
        driverBalances[b.user_id] = {
          amount: b.amount || 0,
          currency: b.currency || 'BYN'
        }
      })
    }
  }

  const boardData = await loadCompanyOrderBoard(supabase,user.id,true)

  return (
    <div className="min-w-0 pb-20">
      <CompanyOrderBoard initialData={boardData} organizationId={user.id} />

      {/* Водители */}
      <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Мои водители</h2>
          <Link
            href="/dashboard/customer/drivers"
            className="text-brand-light hover:text-brand-dark text-sm"
          >
            Управление водителями →
          </Link>
        </div>
        {drivers && drivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.slice(0, 6).map((driver: any) => (
              <Link
                key={driver.id}
                href={`/dashboard/customer/drivers/${driver.id}`}
                className="block border border-gray-200 rounded-lg p-4 bg-gray-100 hover:bg-gray-200 transition cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-3">
                  {driver.avatar_url ? (
                    <img
                      src={driver.avatar_url}
                      alt={driver.full_name || 'Водитель'}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{driver.full_name || 'Без имени'}</p>
                    <p className="text-sm text-gray-600">{driver.phone || 'Телефон не указан'}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-700">
                    <span className="text-gray-600">Транспорт:</span> {
                      driver.vehicle_type === 'car' ? 'Автомобиль' :
                      driver.vehicle_type === 'motorcycle' ? 'Мотоцикл' :
                      driver.vehicle_type === 'bicycle' ? 'Велосипед' :
                      driver.vehicle_type === 'walking' ? 'Пешком' : driver.vehicle_type || 'Не указан'
                    }
                    {driver.vehicle_brand && driver.vehicle_model && (
                      <span className="ml-1">({driver.vehicle_brand} {driver.vehicle_model})</span>
                    )}
                  </p>
                  {driver.vehicle_number && (
                    <p className="text-gray-700">
                      <span className="text-gray-600">Номер:</span> {driver.vehicle_number}
                    </p>
                  )}
                  <p className="text-gray-700 mt-2">
                    <span className="text-gray-600">Касса:</span>
                    <span className="font-semibold text-green-600 ml-1">
                      {driverBalances[driver.id]?.amount?.toFixed(2) || '0.00'} {driverBalances[driver.id]?.currency || 'BYN'}
                    </span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">У вас пока нет водителей. Добавьте водителей в разделе "Водители"</p>
        )}
      </div>

    </div>
  )
}
