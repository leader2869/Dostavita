'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { DriverBottomNavigation } from '@/components/driver/DriverBottomNavigation'

type Period = 'today' | 'week' | 'month' | 'all' | 'custom'

export default function DriverFinancePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [balance, setBalance] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  const getDateFilter = useCallback((period: Period) => {
    const now = new Date()
    switch (period) {
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        return { start: todayStart.toISOString(), end: todayEnd.toISOString() }
      case 'week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - 7)
        weekStart.setHours(0, 0, 0, 0)
        const weekEnd = new Date(now)
        weekEnd.setHours(23, 59, 59, 999)
        return { start: weekStart.toISOString(), end: weekEnd.toISOString() }
      case 'month':
        const monthStart = new Date(now)
        monthStart.setMonth(now.getMonth() - 1)
        monthStart.setHours(0, 0, 0, 0)
        const monthEnd = new Date(now)
        monthEnd.setHours(23, 59, 59, 999)
        return { start: monthStart.toISOString(), end: monthEnd.toISOString() }
      case 'custom':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate)
          start.setHours(0, 0, 0, 0)
          const end = new Date(customEndDate)
          end.setHours(23, 59, 59, 999)
          return { start: start.toISOString(), end: end.toISOString() }
        }
        return { start: null, end: null }
      case 'all':
      default:
        return { start: null, end: null }
    }
  }, [customStartDate, customEndDate])

  const loadData = useCallback(async () => {
    let isMounted = true
    
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        if (isMounted) {
          router.push('/login')
        }
        return
      }

      if (isMounted) {
        setUser(currentUser)
      }

      // Получаем баланс
      const { data: balanceData, error: balanceError } = await supabase
        .from('balances')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle()
      
      if (!isMounted) return
      
      if (balanceError) {
        console.error('Ошибка загрузки баланса:', balanceError)
        // Если баланс не найден, создаем его с нулевым значением
        if (balanceError.code === 'PGRST116') {
          const { data: newBalance } = await supabase
            .from('balances')
            .insert({
              user_id: currentUser.id,
              amount: 0.00,
              currency: 'BYN',
            })
            .select()
            .single()
          if (isMounted) {
            setBalance(newBalance)
          }
        }
      } else {
        if (isMounted) {
          setBalance(balanceData)
        }
      }

      // Получаем транзакции с фильтром по периоду
      const dateFilter = getDateFilter(period as Period)
      let transactionsQuery = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (dateFilter.start) {
        transactionsQuery = transactionsQuery.gte('created_at', dateFilter.start)
      }
      if (dateFilter.end) {
        transactionsQuery = transactionsQuery.lte('created_at', dateFilter.end)
      }

      const { data: transactionsData } = await transactionsQuery
      
      if (isMounted) {
        setTransactions(transactionsData || [])
      }

      // Получаем завершенные заказы с фильтром по периоду
      let ordersQuery = supabase
        .from('orders')
        .select('id, final_price, completed_at')
        .eq('executor_user_id', currentUser.id)
        .eq('status', 'completed')

      if (dateFilter.start) {
        ordersQuery = ordersQuery.gte('completed_at', dateFilter.start)
      }
      if (dateFilter.end) {
        ordersQuery = ordersQuery.lte('completed_at', dateFilter.end)
      }

      const { data: ordersData } = await ordersQuery
      
      if (isMounted) {
        setCompletedOrders(ordersData || [])
        setLoading(false)
      }
    } catch (err: any) {
      if (isMounted) {
        console.error('Ошибка загрузки данных:', err)
        setLoading(false)
      }
    }
  }, [period, getDateFilter, customStartDate, customEndDate]) // Убрали supabase и router из зависимостей

  useEffect(() => {
    loadData()
  }, [loadData])

  // Подсчитываем статистику
  const completedOrdersCount = completedOrders?.length || 0
  const totalEarnings = completedOrders?.reduce((sum, order) => sum + (parseFloat(order.final_price) || 0), 0) || 0

  if (loading) {
    return (
      <div className="pb-20">
        <BackButton />
        <h1 className="text-3xl font-bold mb-6 text-white">Финансы</h1>
        <div className="text-center py-8 text-gray-400">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Финансы</h1>

      {/* Выбор периода */}
      <div className="bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setPeriod('today')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'today'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Сегодня
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'week'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Неделя
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'month'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Месяц
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'all'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Все время
          </button>
          <button
            onClick={() => setPeriod('custom')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'custom'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Произвольная дата
          </button>
        </div>

        {/* Выбор произвольной даты */}
        {period === 'custom' && (
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Дата начала
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Дата окончания
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
              />
            </div>
            <button
              onClick={() => {
                if (customStartDate && customEndDate) {
                  loadData()
                }
              }}
              disabled={!customStartDate || !customEndDate}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Применить
            </button>
          </div>
        )}
      </div>

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
              <div key={transaction.id} className="border-b border-gray-700 pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-white">{transaction.description}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(transaction.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <p className={`font-semibold ${
                    transaction.type === 'credit' ? 'text-green-400' : 'text-red-400'
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
      
      <DriverBottomNavigation />
    </div>
  )
}
