import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import type { User } from '@/lib/types'

export default async function AdminTariffsPage() {
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

  if (!profile || (profile as User).role !== 'superadmin') {
    redirect('/dashboard')
  }

  // Получаем все регионы через RPC функцию (обходит RLS)
  console.log('AdminTariffsPage - Загружаем регионы...')
  let { data: regions, error: regionsError } = await supabase
    .rpc('get_all_regions')
  
  // Fallback на прямой запрос, если RPC не работает
  if (regionsError || !regions) {
    console.log('AdminTariffsPage - RPC не сработал, пробуем прямой запрос...')
    const { data: directRegions, error: directError } = await supabase
      .from('regions')
      .select('*')
      .order('name')
    
    if (directRegions && !directError) {
      regions = directRegions
      regionsError = null
    }
  }
  
  console.log('AdminTariffsPage - Результат загрузки регионов:', {
    count: regions?.length || 0,
    error: regionsError?.message,
    regions: regions
  })

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6">Управление тарифами</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Регион</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Базовая цена</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {regions && regions.length > 0 ? (
              regions.map((region: any) => (
                <tr key={region.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {region.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {region.base_price} BYN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      region.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {region.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <a
                      href={`/dashboard/admin/tariffs/edit/${region.id}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Редактировать
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
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
