import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import type { User } from '@/lib/types'

export default async function AdminUsersPage() {
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

  // Получаем всех пользователей через RPC функцию (обходит RLS)
  let { data: users, error: usersError } = await supabase
    .rpc('get_all_users')
    .limit(100)
  
  // Fallback на прямой запрос, если RPC не работает
  if (usersError || !users) {
    console.log('AdminUsersPage - RPC не сработал, пробуем прямой запрос...')
    const { data: directUsers } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (directUsers) {
      users = directUsers
    }
  }
  
  console.log('AdminUsersPage - Пользователей загружено:', users?.length || 0)

      const roleLabels: Record<string, string> = {
        customer: 'Организация',
        client: 'Клиент',
        driver: 'Исполнитель',
        fleet: 'Автопарк',
        admin: 'Администратор',
        superadmin: 'Суперадмин',
      }

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6">Управление пользователями</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ФИО</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Телефон</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата регистрации</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users && users.length > 0 ? (
              users.map((user: any) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {user.full_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {roleLabels[user.role] || user.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('ru-RU')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Нет пользователей
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
