import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'

export default async function DriverFinancePage() {
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
      profile = directProfile
    }
  }

  if (!profile || profile.role !== 'driver') {
    redirect('/dashboard')
  }

  // Получаем баланс
  const { data: balance } = await supabase
    .from('balances')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Получаем транзакции
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6">Финансы</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Баланс */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Баланс</h2>
          <p className="text-3xl font-bold text-green-600">
            {balance?.amount || 0} {balance?.currency || 'BYN'}
          </p>
        </div>

        {/* Статистика */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Статистика</h2>
          <p className="text-gray-600">Всего транзакций: {transactions?.length || 0}</p>
        </div>
      </div>

      {/* Транзакции */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">История транзакций</h2>
        {transactions && transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((transaction: any) => (
              <div key={transaction.id} className="border-b pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(transaction.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <p className={`font-semibold ${
                    transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'credit' ? '+' : '-'}{transaction.amount} BYN
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Нет транзакций</p>
        )}
      </div>
    </div>
  )
}
