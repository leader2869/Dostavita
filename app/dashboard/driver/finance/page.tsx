import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import type { User } from '@/lib/types'

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
      profile = directProfile as User
    }
  }

  if (!profile || (profile as User).role !== 'driver') {
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

  // Получаем завершенные заказы водителя
  const { data: completedOrders } = await supabase
    .from('orders')
    .select('id, final_price')
    .eq('executor_user_id', user.id)
    .eq('status', 'completed')

  // Подсчитываем статистику
  const completedOrdersCount = completedOrders?.length || 0
  const totalEarnings = completedOrders?.reduce((sum, order) => sum + (parseFloat(order.final_price) || 0), 0) || 0

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Финансы</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Баланс */}
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Баланс</h2>
          <p className="text-3xl font-bold text-green-600">
            {balance?.amount || 0} {balance?.currency || 'BYN'}
          </p>
        </div>

        {/* Статистика */}
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Статистика</h2>
          <div className="space-y-2">
            <p className="text-gray-300">
              Завершенных заказов: <span className="text-white font-semibold">{completedOrdersCount}</span>
            </p>
            <p className="text-gray-300">
              Общая сумма: <span className="text-green-400 font-semibold">{totalEarnings.toFixed(2)} BYN</span>
            </p>
            <p className="text-gray-300">
              Всего транзакций: <span className="text-white font-semibold">{transactions?.length || 0}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Транзакции */}
      <div className="bg-gray-800 rounded-lg shadow p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4 text-white">История транзакций</h2>
        {transactions && transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((transaction: any) => (
              <div key={transaction.id} className="border-b pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-sm text-gray-400">
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
          <p className="text-gray-400">Нет транзакций</p>
        )}
      </div>
      
      {/* Нижняя навигация */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex justify-around items-center h-16">
          <a
            href="/dashboard/driver"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Главная</span>
          </a>
          <a
            href="/dashboard/driver/my-orders"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Заказы</span>
          </a>
          <a
            href="/dashboard/driver/finance"
            className="flex flex-col items-center justify-center flex-1 h-full text-green-400 hover:text-green-300 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">Финансы</span>
          </a>
          <a
            href="/dashboard/driver/profile"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs">Профиль</span>
          </a>
        </div>
      </div>
    </div>
  )
}
