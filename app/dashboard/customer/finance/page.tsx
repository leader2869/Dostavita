'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'

type Period = 'today' | 'week' | 'month' | 'all' | 'custom'

export default function CustomerFinancePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [finances, setFinances] = useState<any[]>([])
  const [receivables, setReceivables] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  const getDateFilter = useCallback((period: Period) => {
    const now = new Date()
    switch (period) {
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        return { start: todayStart.toISOString(), end: null }
      case 'week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - 7)
        return { start: weekStart.toISOString(), end: null }
      case 'month':
        const monthStart = new Date(now)
        monthStart.setMonth(now.getMonth() - 1)
        return { start: monthStart.toISOString(), end: null }
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
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        router.push('/login')
        return
      }

      setUser(currentUser)

      const dateFilter = getDateFilter(period as Period)
      
      // Получаем финансы водителей организации
      const { data: financesData, error: financesError } = await supabase
        .rpc('get_organization_finances', {
          organization_user_id: currentUser.id,
          start_date: dateFilter.start,
          end_date: dateFilter.end
        })

      if (financesError) {
        console.error('Ошибка загрузки финансов:', financesError)
      } else {
        setFinances(financesData || [])
      }

      // Получаем дебиторку организации
      const { data: receivablesData, error: receivablesError } = await supabase
        .rpc('get_organization_receivables', {
          organization_user_id: currentUser.id,
          start_date: dateFilter.start,
          end_date: dateFilter.end
        })

      if (receivablesError) {
        console.error('Ошибка загрузки дебиторки:', receivablesError)
      } else {
        setReceivables(receivablesData || [])
      }
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, period, customStartDate, customEndDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Подсчитываем общую статистику
  const totalDrivers = finances.length
  const totalCompletedOrders = finances.reduce((sum, f) => sum + (parseInt(f.completed_orders_count) || 0), 0)
  const totalEarnings = finances.reduce((sum, f) => sum + (parseFloat(f.total_earnings) || 0), 0)
  const totalBalance = finances.reduce((sum, f) => sum + (parseFloat(f.balance) || 0), 0)
  const totalReceivables = receivables.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

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

      {/* Общая статистика */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-400 mb-2">Водителей</h3>
          <p className="text-3xl font-bold text-white">{totalDrivers}</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-400 mb-2">Завершенных заказов</h3>
          <p className="text-3xl font-bold text-green-400">{totalCompletedOrders}</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-400 mb-2">Общая сумма</h3>
          <p className="text-3xl font-bold text-blue-400">{totalEarnings.toFixed(2)} BYN</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-400 mb-2">Общий баланс</h3>
          <p className="text-3xl font-bold text-purple-400">{totalBalance.toFixed(2)} BYN</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-400 mb-2">Дебиторка</h3>
          <p className="text-3xl font-bold text-red-400">{totalReceivables.toFixed(2)} BYN</p>
        </div>
      </div>

      {/* Финансы по водителям */}
      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Финансы по водителям</h2>
        {finances && finances.length > 0 ? (
          <div className="space-y-4">
            {finances.map((finance: any) => (
              <div key={finance.driver_id} className="border border-gray-700 rounded-lg p-4 bg-gray-700">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-white text-lg">{finance.driver_full_name || 'Без имени'}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-gray-300">
                        Завершенных заказов: <span className="text-white font-semibold">{finance.completed_orders_count || 0}</span>
                      </p>
                      <p className="text-gray-300">
                        Общая сумма: <span className="text-green-400 font-semibold">{parseFloat(finance.total_earnings || 0).toFixed(2)} BYN</span>
                      </p>
                      <p className="text-gray-300">
                        Баланс: <span className="text-blue-400 font-semibold">{parseFloat(finance.balance || 0).toFixed(2)} BYN</span>
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/dashboard/customer/drivers/${finance.driver_id}`}
                    className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
                  >
                    Подробнее
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">Нет данных за выбранный период</p>
        )}
      </div>

      {/* Дебиторка */}
      <div className="bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Дебиторка (неоплаченные заказы)</h2>
        {receivables && receivables.length > 0 ? (
          <div className="space-y-4">
            {receivables.map((receivable: any) => (
              <div key={receivable.id} className="border border-red-500/50 rounded-lg p-4 bg-gray-700/50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold text-white text-lg">
                        Заказ {receivable.order_number ? `№${receivable.order_number}` : 'без номера'}
                      </p>
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                        Не оплачен
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-gray-300">
                        Сумма: <span className="text-red-400 font-semibold">{parseFloat(receivable.amount || 0).toFixed(2)} BYN</span>
                      </p>
                      <p className="text-gray-300">
                        Должник: <span className="text-white font-semibold capitalize">
                          {receivable.debtor_type === 'sender' ? 'Отправитель' : 'Получатель'}
                        </span>
                        {receivable.debtor_name && (
                          <span className="text-gray-400 ml-1">({receivable.debtor_name})</span>
                        )}
                      </p>
                      {receivable.debtor_phone && (
                        <p className="text-gray-300">
                          Телефон: <a href={`tel:${receivable.debtor_phone}`} className="text-green-400 hover:text-green-300">{receivable.debtor_phone}</a>
                        </p>
                      )}
                      <p className="text-gray-300">
                        Водитель: <span className="text-white">{receivable.driver_full_name || 'Неизвестно'}</span>
                      </p>
                      {receivable.pickup_address && (
                        <p className="text-gray-400 text-xs mt-1">
                          Откуда: {receivable.pickup_address}
                        </p>
                      )}
                      {receivable.delivery_address && (
                        <p className="text-gray-400 text-xs">
                          Куда: {receivable.delivery_address}
                        </p>
                      )}
                      <p className="text-gray-400 text-xs mt-1">
                        Дата: {new Date(receivable.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">Нет дебиторки за выбранный период</p>
        )}
      </div>

      {/* Нижняя навигация */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex justify-around items-center h-16">
          <a
            href="/dashboard/customer"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Главная</span>
          </a>
          <a
            href="/dashboard/customer/drivers"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs">Водители</span>
          </a>
          <a
            href="/dashboard/customer/orders"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Заказы</span>
          </a>
          <a
            href="/dashboard/customer/finance"
            className="flex flex-col items-center justify-center flex-1 h-full text-green-400 hover:text-green-300 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">Финансы</span>
          </a>
          <a
            href="/dashboard/customer/tracking"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">Отслеживание</span>
          </a>
        </div>
      </div>
    </div>
  )
}

