'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { DriverBottomNavigation } from '@/components/driver/DriverBottomNavigation'
import { exportFinanceReportToExcel, exportOrdersToExcel, exportTransactionsToExcel } from '@/lib/utils/exportToExcel'

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

export default function DriverFinancePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [balance, setBalance] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [unpaidOrdersFromReceivables, setUnpaidOrdersFromReceivables] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('today')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [depositAmount, setDepositAmount] = useState<string>('')
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [cashDepositRequests, setCashDepositRequests] = useState<any[]>([])
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'credit' | 'debit'>('all')

  const getDateFilter = useCallback((period: Period) => {
    const now = new Date()
    switch (period) {
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        return { start: todayStart.toISOString(), end: todayEnd.toISOString() }
      case 'yesterday':
        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0)
        const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999)
        return { start: yesterdayStart.toISOString(), end: yesterdayEnd.toISOString() }
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

      // Получаем профиль водителя (для проверки organization_id)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, organization_id, role')
        .eq('id', currentUser.id)
        .single()
      
      if (isMounted && profileData) {
        setProfile(profileData)
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

      const { data: transactionsData, error: transactionsError } = await transactionsQuery
      
      if (transactionsError) {
        console.error('Ошибка загрузки транзакций:', transactionsError)
      }
      
      if (isMounted) {
        setTransactions(transactionsData || [])
        console.log('Загружено транзакций:', transactionsData?.length || 0)
      }

      // Получаем завершенные заказы с фильтром по периоду для статистики
      let ordersQuery = supabase
        .from('orders')
        .select('id, order_number, final_price, completed_at, is_paid, pickup_address, delivery_address, created_at')
        .eq('executor_user_id', currentUser.id)
        .eq('status', 'completed')
        
      console.log('=== Loading completed orders ===')
      console.log('Executor user ID:', currentUser.id)

      if (dateFilter.start) {
        ordersQuery = ordersQuery.gte('completed_at', dateFilter.start)
      }
      if (dateFilter.end) {
        ordersQuery = ordersQuery.lte('completed_at', dateFilter.end)
      }

      const { data: ordersData, error: ordersError } = await ordersQuery
      
      console.log('=== Completed orders loaded ===')
      console.log('Orders count:', ordersData?.length || 0)
      console.log('Orders error:', ordersError)
      
      // Получаем неоплаченные заказы из receivables по driver_user_id
      let receivablesQuery = supabase
        .from('receivables')
        .select('id, order_id, amount, currency, status, created_at')
        .eq('driver_user_id', currentUser.id)
        .eq('status', 'unpaid')
      
      if (dateFilter.start) {
        receivablesQuery = receivablesQuery.gte('created_at', dateFilter.start)
      }
      if (dateFilter.end) {
        receivablesQuery = receivablesQuery.lte('created_at', dateFilter.end)
      }
      
      const { data: receivablesData, error: receivablesError } = await receivablesQuery
      
      console.log('=== Receivables loaded ===')
      console.log('Receivables count:', receivablesData?.length || 0)
      console.log('Receivables error:', receivablesError)
      if (receivablesData && receivablesData.length > 0) {
        console.log('Первая receivable:', JSON.stringify(receivablesData[0], null, 2))
        console.log('receivablesData[0].order_id:', receivablesData[0].order_id)
        console.log('receivablesData[0].order_id type:', typeof receivablesData[0].order_id)
        console.log('receivablesData[0].order_id length:', receivablesData[0].order_id?.length)
      }
      
      // Получаем данные заказов для receivables
      let receivablesWithOrders: any[] = []
      if (receivablesData && receivablesData.length > 0) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const orderIds = receivablesData
          .map((r: any) => {
            if (!r.order_id) {
              console.warn('⚠️ receivable без order_id:', r)
              return null
            }
            const isValid = uuidRegex.test(String(r.order_id))
            if (!isValid) {
              console.warn('⚠️ receivable с невалидным order_id:', r.order_id, 'receivable:', r)
              return null
            }
            return r.order_id
          })
          .filter((id: any): id is string => id !== null)
        
        console.log('orderIds для загрузки:', orderIds)
        console.log('orderIds count:', orderIds.length)
        
        if (orderIds.length > 0) {
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('id, order_number, final_price, completed_at, is_paid, pickup_address, delivery_address, created_at')
            .in('id', orderIds)
          
          console.log('Orders loaded for receivables:', ordersData?.length || 0)
          console.log('Orders error:', ordersError)
          if (ordersData && ordersData.length > 0) {
            console.log('Первая order:', JSON.stringify(ordersData[0], null, 2))
          }
          
          if (ordersError) {
            console.error('Ошибка загрузки заказов для receivables:', ordersError)
          } else {
            // Объединяем receivables с orders
            receivablesWithOrders = receivablesData.map((receivable: any) => {
              const order = ordersData?.find((o: any) => o.id === receivable.order_id)
              if (!order) {
                console.warn('⚠️ Заказ не найден для receivable:', receivable.order_id, 'receivable:', receivable)
              }
              return {
                ...receivable,
                orders: order
              }
            })
            console.log('receivablesWithOrders count:', receivablesWithOrders.length)
          }
        } else {
          console.warn('⚠️ Нет валидных order_id для загрузки заказов')
        }
      }
      
      if (isMounted) {
        setCompletedOrders(ordersData || [])
        // Сохраняем receivables с данными заказов для отображения неоплаченных заказов
        console.log('🔵 Сохраняем receivablesWithOrders:', receivablesWithOrders.length)
        if (receivablesWithOrders.length > 0) {
          console.log('🔵 Первая receivable с order:', receivablesWithOrders[0])
          console.log('🔵 Первая receivable.orders:', receivablesWithOrders[0].orders)
          console.log('🔵 Первая receivable.orders.id:', receivablesWithOrders[0].orders?.id)
        }
        setUnpaidOrdersFromReceivables(receivablesWithOrders || [])
        setLoading(false)
      }
    } catch (err: any) {
      if (isMounted) {
        console.error('Ошибка загрузки данных:', err)
        setLoading(false)
      }
    }
  }, [period, getDateFilter, customStartDate, customEndDate, supabase, router]) // Добавили supabase и router обратно

  useEffect(() => {
    loadData()
  }, [loadData])

  // Подсчитываем статистику из завершенных заказов
  const allOrders = completedOrders || []
  
  // Фильтруем заказы с валидными UUID (на случай, если в базе есть некорректные данные)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const validOrders = allOrders.filter((order: any) => {
    const orderIdStr = String(order.id || '').trim()
    return orderIdStr.length === 36 && uuidRegex.test(orderIdStr)
  })
  
  const totalOrdersAmount = validOrders.reduce((sum, order) => sum + (parseFloat(order.final_price) || 0), 0) || 0
  
  const paidOrders = validOrders.filter(order => order.is_paid === true) || []
  const paidAmount = paidOrders.reduce((sum, order) => sum + (parseFloat(order.final_price) || 0), 0) || 0
  
  // Неоплаченные заказы берем из receivables
  // Преобразуем данные из receivables в формат для отображения
  const unpaidOrders = (unpaidOrdersFromReceivables || []).map((receivable: any) => {
    const order = receivable.orders
    console.log('=== Формирование unpaidOrders ===')
    console.log('receivable:', receivable)
    console.log('receivable.orders:', order)
    console.log('order.id:', order?.id)
    console.log('order.id type:', typeof order?.id)
    
    if (!order || !order.id) {
      console.error('❌ ОШИБКА: order или order.id отсутствует!')
      console.error('receivable:', JSON.stringify(receivable, null, 2))
    }
    
    return {
      id: order?.id,
      order_number: order?.order_number,
      final_price: receivable.amount || order?.final_price,
      completed_at: order?.completed_at,
      is_paid: order?.is_paid,
      pickup_address: order?.pickup_address,
      delivery_address: order?.delivery_address,
      created_at: order?.created_at,
      receivable_id: receivable.id,
      _debug_receivable: receivable  // Для отладки
    }
  }).filter((order: any) => {
    // Фильтруем заказы с валидными UUID
    if (!order.id) {
      console.warn('⚠️ Заказ без ID отфильтрован:', order)
      return false
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isValid = uuidRegex.test(String(order.id))
    if (!isValid) {
      console.warn('⚠️ Заказ с невалидным UUID отфильтрован:', order)
    }
    return isValid
  })
  
  const unpaidAmount = unpaidOrders.reduce((sum, order) => sum + (parseFloat(order.final_price) || 0), 0) || 0

  if (loading) {
    return (
      <div className="pb-20">
        <BackButton />
        <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => {
            const filename = `Финансовый_отчет_водителя_${period}_${new Date().toISOString().split('T')[0]}`
            exportFinanceReportToExcel({
              orders: completedOrders,
              transactions: transactions,
              summary: {
                'Баланс': balance?.amount ? parseFloat(balance.amount).toFixed(2) + ' BYN' : '0.00 BYN',
                'Общая сумма заказов': totalOrdersAmount.toFixed(2) + ' BYN',
                'Оплачено': paidAmount.toFixed(2) + ' BYN',
                'Неоплачено': (totalOrdersAmount - paidAmount).toFixed(2) + ' BYN',
                'Количество завершенных заказов': completedOrders.length,
                'Количество неоплаченных заказов': unpaidOrders.length,
                'Период': period === 'all' ? 'Все время' : period === 'today' ? 'Сегодня' : period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Выбранный период',
              }
            }, filename)
          }}
          className="bg-brand-light hover:bg-brand-dark text-white px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2"
          title="Экспорт всех данных в Excel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Экспорт в Excel
        </button>
      </div>
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <BackButton />
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => {
            const filename = `Финансовый_отчет_водителя_${period}_${new Date().toISOString().split('T')[0]}`
            exportFinanceReportToExcel({
              orders: completedOrders,
              transactions: transactions,
              summary: {
                'Баланс': balance?.amount ? parseFloat(balance.amount).toFixed(2) + ' BYN' : '0.00 BYN',
                'Общая сумма заказов': totalOrdersAmount.toFixed(2) + ' BYN',
                'Оплачено': paidAmount.toFixed(2) + ' BYN',
                'Неоплачено': (totalOrdersAmount - paidAmount).toFixed(2) + ' BYN',
                'Количество завершенных заказов': completedOrders.length,
                'Количество неоплаченных заказов': unpaidOrders.length,
                'Период': period === 'all' ? 'Все время' : period === 'today' ? 'Сегодня' : period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Выбранный период',
              }
            }, filename)
          }}
          className="bg-brand-light hover:bg-brand-dark text-white px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2"
          title="Экспорт всех данных в Excel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Экспорт в Excel
        </button>
      </div>

      {/* Выбор периода */}
      <div className="bg-gray-50 rounded-lg shadow p-4 mb-6">
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setPeriod('today')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'today'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Сегодня
          </button>
          <button
            onClick={() => setPeriod('yesterday')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'yesterday'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Вчера
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'week'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Неделя
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'month'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Месяц
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'all'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Все время
          </button>
          <button
            onClick={() => setPeriod('custom')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'custom'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Произвольная дата
          </button>
        </div>

        {/* Выбор произвольной даты */}
        {period === 'custom' && (
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата начала
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дата окончания
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900"
              />
            </div>
            <button
              onClick={() => {
                if (customStartDate && customEndDate) {
                  loadData()
                }
              }}
              disabled={!customStartDate || !customEndDate}
              className="px-6 py-2 bg-brand-light text-gray-900 rounded-md hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Применить
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Баланс */}
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Баланс</h2>
          <p className="text-3xl font-bold text-green-600">
            {balance?.amount ? parseFloat(balance.amount).toFixed(2) : '0.00'} {balance?.currency || 'BYN'}
          </p>
          {profile?.organization_id && (
            <>
              <button
                onClick={() => setShowDepositModal(true)}
                className="mt-4 w-full bg-green-300 text-gray-900 px-4 py-2 rounded-md hover:bg-green-400 transition"
              >
                Отправить запрос на сдачу кассы
              </button>
              
              {/* Запросы на сдачу кассы */}
              {cashDepositRequests.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Запросы на сдачу кассы</h3>
                  <div className="space-y-2">
                    {cashDepositRequests.map((request: any) => (
                      <div key={request.id} className="bg-gray-100 rounded p-3 text-sm">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-gray-900 font-medium">{request.amount} BYN</p>
                            <p className="text-gray-600 text-xs">
                              {request.status === 'pending' && '⏳ Ожидает принятия'}
                              {request.status === 'approved' && '✅ Принято'}
                              {request.status === 'rejected' && '❌ Отклонено'}
                              {request.status === 'cancelled' && '🚫 Отменено'}
                            </p>
                            <p className="text-gray-500 text-xs">
                              {new Date(request.created_at).toLocaleString('ru-RU')}
                            </p>
                          </div>
                          {request.status === 'pending' && (
                            <button
                              onClick={async () => {
                                if (!confirm('Отменить запрос на сдачу кассы?')) return
                                try {
                                  const { error } = await supabase.rpc('cancel_cash_deposit_request', {
                                    request_id: request.id
                                  })
                                  if (error) {
                                    alert(`Ошибка: ${error.message}`)
                                  } else {
                                    loadData()
                                  }
                                } catch (err: any) {
                                  alert(`Ошибка: ${err.message}`)
                                }
                              }}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              Отменить
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Статистика */}
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Статистика</h2>
          <div className="space-y-2">
            <p className="text-gray-700">
              Выполнено заказов: <span className="text-gray-900 font-semibold">{completedOrders?.length || 0}</span>
            </p>
            <p className="text-gray-700">
              Общая сумма заказов: <span className="text-gray-900 font-semibold">{totalOrdersAmount.toFixed(2)} BYN</span>
            </p>
            <p className="text-gray-700">
              Оплачено: <span className="text-green-600 font-semibold">{paidAmount.toFixed(2)} BYN</span>
            </p>
            <p className="text-gray-700">
              Неоплачено: <span className="text-red-400 font-semibold">{unpaidAmount.toFixed(2)} BYN</span>
            </p>
            <p className="text-gray-700">
              Всего транзакций: <span className="text-gray-900 font-semibold">{transactions?.length || 0}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Неоплаченные заказы */}
      {unpaidOrders.length > 0 && (
        <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Неоплаченные заказы</h2>
            <button
              onClick={() => {
                const filename = `Неоплаченные_заказы_${new Date().toISOString().split('T')[0]}`
                exportOrdersToExcel(unpaidOrders, filename)
              }}
              className="bg-brand-light hover:bg-brand-dark text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1"
              title="Экспорт неоплаченных заказов в Excel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Экспорт
            </button>
          </div>
          <div className="space-y-3">
            {unpaidOrders.map((order: any) => (
              <div key={order.id} className="border border-red-700 rounded-lg p-4 bg-red-900/10">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      Заказ №{order.order_number || order.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      {order.pickup_address} → {order.delivery_address}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Завершен: {new Date(order.completed_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xl font-bold text-red-400">{order.final_price} BYN</p>
                    <button
                      onClick={async () => {
                        if (!confirm(`Принять оплату заказа №${order.order_number || order.id?.slice(0, 8) || 'N/A'}? Деньги будут начислены на ваш баланс.`)) {
                          return
                        }
                        try {
                          const orderUuid = String(order.id || '').trim()
                          
                          // Проверяем, что UUID валиден
                          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                          if (!uuidRegex.test(orderUuid)) {
                            alert(`Ошибка: Невалидный ID заказа. Пожалуйста, обновите страницу.`)
                            return
                          }
                          
                          const { data, error } = await supabase.rpc('process_order_payment', {
                            order_uuid: orderUuid,
                            payment_status: true
                          })
                          
                          if (error) {
                            alert(`Ошибка: ${error.message}`)
                          } else if (data === false) {
                            alert('Не удалось обработать оплату. Возможно, заказ уже обработан или не найден.')
                          } else {
                            alert('Оплата успешно принята! Деньги начислены на ваш баланс.')
                            setTimeout(() => {
                              loadData()
                            }, 2000)
                          }
                        } catch (err: any) {
                          alert(`Ошибка: ${err.message || 'Не удалось обработать оплату'}`)
                        }
                      }}
                      className="mt-2 bg-green-500 text-white px-3 py-1.5 rounded text-sm hover:bg-green-600 transition"
                    >
                      Принять оплату
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модальное окно сдачи кассы */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-50 rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Запрос на сдачу кассы</h2>
            <p className="text-gray-700 mb-2">
              Доступный баланс: <span className="text-brand-light font-semibold">
                {balance?.amount ? parseFloat(balance.amount).toFixed(2) : '0.00'} BYN
              </span>
            </p>
            <p className="text-gray-600 text-sm mb-4">
              После отправки запроса деньги останутся на вашем балансе до принятия запроса организацией.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Сумма для сдачи
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={balance?.amount || 0}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-light"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const amount = parseFloat(depositAmount)
                  if (!amount || amount <= 0) {
                    alert('Введите корректную сумму')
                    return
                  }
                  if (amount > parseFloat(balance?.amount || 0)) {
                    alert('Недостаточно средств на балансе')
                    return
                  }
                  
                  try {
                    const { data: requestId, error } = await supabase.rpc('deposit_cash_to_organization', {
                      driver_user_id: user.id,
                      amount_to_deposit: amount
                    })
                    
                    if (error) {
                      console.error('Ошибка создания запроса:', error)
                      alert(`Ошибка: ${error.message}`)
                    } else {
                      alert('Запрос на сдачу кассы отправлен! Деньги останутся на вашем балансе до принятия запроса организацией.')
                      setShowDepositModal(false)
                      setDepositAmount('')
                      loadData()
                    }
                  } catch (err: any) {
                    console.error('Ошибка создания запроса:', err)
                    alert(`Ошибка: ${err.message || 'Не удалось создать запрос'}`)
                  }
                }}
                className="flex-1 bg-brand-light text-gray-900 px-4 py-2 rounded-md hover:bg-brand-dark transition"
              >
                Отправить запрос
              </button>
              <button
                onClick={() => {
                  setShowDepositModal(false)
                  setDepositAmount('')
                }}
                className="flex-1 bg-gray-600 text-gray-900 px-4 py-2 rounded-md hover:bg-gray-100 transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Транзакции */}
      <div className="bg-gray-50 rounded-lg shadow p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">История транзакций</h2>
          <button
            onClick={() => {
              const filename = `Транзакции_${period}_${new Date().toISOString().split('T')[0]}`
              exportTransactionsToExcel(transactions, filename)
            }}
            className="bg-brand-light hover:bg-brand-dark text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1"
            title="Экспорт транзакций в Excel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Экспорт
          </button>
        </div>
        
        {/* Фильтр транзакций */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTransactionFilter('all')}
            className={`px-4 py-2 rounded-md transition text-sm ${
              transactionFilter === 'all'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Все операции
          </button>
          <button
            onClick={() => setTransactionFilter('credit')}
            className={`px-4 py-2 rounded-md transition text-sm ${
              transactionFilter === 'credit'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Только приход
          </button>
          <button
            onClick={() => setTransactionFilter('debit')}
            className={`px-4 py-2 rounded-md transition text-sm ${
              transactionFilter === 'debit'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Только расходы
          </button>
        </div>
        
        {(() => {
          const filteredTransactions = transactions.filter((t: any) => {
            if (transactionFilter === 'all') return true
            if (transactionFilter === 'credit') return t.type === 'credit'
            if (transactionFilter === 'debit') return t.type === 'debit'
            return true
          })
          
          return filteredTransactions && filteredTransactions.length > 0 ? (
            <div className="space-y-2">
              {filteredTransactions.map((transaction: any) => (
              <div key={transaction.id} className="border-b border-gray-200 pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">{transaction.description}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(transaction.created_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <p className={`font-semibold ${
                    transaction.type === 'credit' ? 'text-green-600' : 'text-red-400'
                  }`}>
                    {transaction.type === 'credit' ? '+' : '-'}{transaction.amount} BYN
                  </p>
                </div>
              </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">
              {transactions && transactions.length > 0 
                ? 'Нет транзакций по выбранному фильтру' 
                : 'Нет транзакций'}
            </p>
          )
        })()}
      </div>
      
      <DriverBottomNavigation />
    </div>
  )
}
