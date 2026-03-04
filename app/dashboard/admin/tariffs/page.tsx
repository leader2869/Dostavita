import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import type { User } from '@/lib/types'
import { getCachedUserAndProfile } from '@/lib/supabase/cached-auth'

export default async function AdminTariffsPage() {
  const supabase = createServerSupabaseClient()
  const { user, profile, authError } = await getCachedUserAndProfile()

  if (authError || !user) redirect('/login')
  if (!profile || (profile as User).role !== 'superadmin') redirect('/dashboard')

  // Получаем все регионы через RPC функцию (обходит RLS)
  let { data: regions, error: regionsError } = await supabase
    .rpc('get_all_regions')
  
  if (regionsError || !regions) {
    const { data: directRegions, error: directError } = await supabase
      .from('regions')
      .select('*')
      .order('name')
    
    if (directRegions && !directError) {
      regions = directRegions
      regionsError = null
    }
  }

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Управление тарифами</h1>

      <div className="bg-gray-50 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Регион</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Базовая цена</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Статус</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-gray-50 divide-y divide-gray-700">
            {regions && regions.length > 0 ? (
              regions.map((region: any) => (
                <tr key={region.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {region.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {region.base_price} BYN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      region.is_active ? 'bg-brand-light text-gray-900' : 'bg-red-600 text-gray-900'
                    }`}>
                      {region.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <a
                      href={`/dashboard/admin/tariffs/edit/${region.id}`}
                      className="text-brand-light hover:text-brand-light"
                    >
                      Редактировать
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-600">
                  Нет регионов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
