'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { exportFinanceReportToExcel, exportOrdersToExcel, exportReceivablesToExcel, exportTransactionsToExcel } from '@/lib/utils/exportToExcel'

type Period = 'today' | 'week' | 'month' | 'all' | 'custom'

export default function CustomerFinancePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [balance, setBalance] = useState<any>(null)
  const [finances, setFinances] = useState<any[]>([])
  const [receivables, setReceivables] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('week')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<any>(null)
  const [withdrawAmount, setWithdrawAmount] = useState<string>('')
  const [cashDepositRequests, setCashDepositRequests] = useState<any[]>([])
  const [showDebtorModal, setShowDebtorModal] = useState(false)
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null)
  const [debtorReceivables, setDebtorReceivables] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [expandedDebtors, setExpandedDebtors] = useState<Set<string>>(new Set())

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

      // Получаем баланс организации
      const { data: balanceData, error: balanceError } = await supabase
        .from('balances')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle()
      
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
          setBalance(newBalance)
        }
      } else {
        setBalance(balanceData)
      }

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
      console.log('=== Загрузка дебиторки ===')
      console.log('Organization user ID:', currentUser.id)
      console.log('Date filter:', dateFilter)
      
      const { data: receivablesData, error: receivablesError } = await supabase
        .rpc('get_organization_receivables', {
          organization_user_id: currentUser.id,
          start_date: dateFilter.start,
          end_date: dateFilter.end
        })

      console.log('=== Результат загрузки дебиторки ===')
      console.log('Receivables data:', receivablesData)
      console.log('Receivables count:', receivablesData?.length || 0)
      console.log('Receivables error:', receivablesError)

      if (receivablesError) {
        console.error('❌ Ошибка загрузки дебиторки:', receivablesError)
        console.error('Детали ошибки:', {
          message: receivablesError.message,
          code: receivablesError.code,
          details: receivablesError.details,
          hint: receivablesError.hint
        })
        // Устанавливаем пустой массив при ошибке, чтобы не показывать ошибку пользователю
        setReceivables([])
      } else {
        console.log('✅ Дебиторка загружена успешно')
        console.log('Количество записей:', receivablesData?.length || 0)
        if (receivablesData && receivablesData.length > 0) {
          console.log('Первая запись:', receivablesData[0])
        }
        setReceivables(receivablesData || [])
      }
      
      // Дополнительная проверка: пытаемся получить дебиторку напрямую из таблицы
      console.log('=== Прямая проверка таблицы receivables ===')
      const { data: directReceivables, error: directError } = await supabase
        .from('receivables')
        .select('*, orders(order_number), profiles!receivables_driver_user_id_fkey(full_name, organization_id)')
        .eq('status', 'unpaid')
        .limit(10)
      
      console.log('Прямой запрос к receivables:', directReceivables)
      console.log('Ошибка прямого запроса:', directError)
      
      // Загружаем все запросы на сдачу кассы от водителей (все статусы)
      const { data: requestsData, error: requestsError } = await supabase
        .from('cash_deposit_requests')
        .select(`
          *,
          profiles!cash_deposit_requests_driver_user_id_fkey(full_name)
        `)
        .eq('organization_id', currentUser.id)
        .order('created_at', { ascending: false })
      
      if (requestsError) {
        console.error('Ошибка загрузки запросов на сдачу кассы:', requestsError)
      }
      
      setCashDepositRequests(requestsData || [])
      
      // Загружаем транзакции всех водителей организации
      const transactionsDateFilter = getDateFilter(period as Period)
      let transactionsQuery = supabase
        .from('transactions')
        .select('*, profiles!transactions_user_id_fkey(id, full_name)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (transactionsDateFilter.start) {
        transactionsQuery = transactionsQuery.gte('created_at', transactionsDateFilter.start)
      }
      if (transactionsDateFilter.end) {
        transactionsQuery = transactionsQuery.lte('created_at', transactionsDateFilter.end)
      }

      const { data: transactionsData, error: transactionsError } = await transactionsQuery
      
      if (transactionsError) {
        console.error('Ошибка загрузки транзакций:', transactionsError)
      } else {
        console.log('Загружено транзакций для организации:', transactionsData?.length || 0)
        setTransactions(transactionsData || [])
      }
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, period, customStartDate, customEndDate, getDateFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Подсчитываем общую статистику
  const totalDrivers = finances.length
  const totalCompletedOrders = finances.reduce((sum, f) => sum + (parseInt(f.completed_orders_count) || 0), 0)
  const totalEarnings = finances.reduce((sum, f) => sum + (parseFloat(f.total_earnings) || 0), 0)
  const totalBalance = finances.reduce((sum, f) => sum + (parseFloat(f.balance) || 0), 0)
  const totalReceivables = receivables.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

  // Группируем дебиторку по должникам
  const groupedByDebtor = receivables.reduce((acc: any, receivable: any) => {
    const debtorId = receivable.debtor_user_id || 'unknown'
    if (!acc[debtorId]) {
      acc[debtorId] = {
        debtor_user_id: debtorId,
        debtor_name: receivable.debtor_name || 'Неизвестно',
        debtor_organization_name: receivable.debtor_organization_name || null,
        debtor_phone: receivable.debtor_phone || null,
        receivables: [],
        totalAmount: 0,
        ordersCount: 0
      }
    }
    acc[debtorId].receivables.push(receivable)
    acc[debtorId].totalAmount += parseFloat(receivable.amount || 0)
    acc[debtorId].ordersCount += 1
    return acc
  }, {})

  const debtorsList = Object.values(groupedByDebtor)

  const toggleDebtor = (debtorId: string) => {
    setExpandedDebtors(prev => {
      const newSet = new Set(prev)
      if (newSet.has(debtorId)) {
        newSet.delete(debtorId)
      } else {
        newSet.add(debtorId)
      }
      return newSet
    })
  }

  if (loading) {
    return (
      <div className="pb-20">
        <BackButton />
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }

  const handleExportAll = () => {
    const filename = `Финансовый_отчет_организации_${period}_${new Date().toISOString().split('T')[0]}`
    exportFinanceReportToExcel({
      receivables: receivables,
      summary: {
        'Баланс организации': balance?.amount ? parseFloat(balance.amount).toFixed(2) + ' BYN' : '0.00 BYN',
        'Общая дебиторка': totalReceivables.toFixed(2) + ' BYN',
        'Количество неоплаченных заказов': receivables.length,
        'Количество водителей': totalDrivers,
        'Завершенных заказов': totalCompletedOrders,
        'Общая сумма заказов': totalEarnings.toFixed(2) + ' BYN',
        'Период': period === 'all' ? 'Все время' : period === 'today' ? 'Сегодня' : period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Выбранный период',
      }
    }, filename)
  }

  return (
    <div className="pb-20">
      <BackButton />
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleExportAll}
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

      {/* Баланс организации */}
      <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Баланс организации</h2>
        <p className="text-3xl font-bold text-brand-light">
          {balance?.amount ? parseFloat(balance.amount).toFixed(2) : '0.00'} {balance?.currency || 'BYN'}
        </p>
        <p className="text-sm text-gray-600 mt-2">
          Сумма, полученная от водителей (сдача кассы)
        </p>
      </div>

      {/* Запросы на сдачу кассы от водителей - размещаем сверху */}
      {/* Показываем блок только если есть pending (активные) запросы */}
      {cashDepositRequests.some((r: any) => r.status === 'pending') && (
        <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Запросы на сдачу кассы</h2>
          <div className="space-y-3">
            {/* Показываем только pending (ожидающие принятия) запросы */}
            {cashDepositRequests.filter((r: any) => r.status === 'pending').map((request: any) => (
              <div key={request.id} className="border border-blue-500/50 rounded-lg p-4 bg-gray-100/50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold text-gray-900 text-lg">
                        {request.profiles?.full_name || 'Водитель без имени'}
                      </p>
                      <span className={`px-2 py-1 text-xs rounded ${
                        request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        request.status === 'approved' ? 'bg-brand-light/20 text-brand-light' :
                        request.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-600'
                      }`}>
                        {request.status === 'pending' && 'Ожидает принятия'}
                        {request.status === 'approved' && 'Принято'}
                        {request.status === 'rejected' && 'Отклонено'}
                        {request.status === 'cancelled' && 'Отменено'}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-blue-400 mb-2">
                      {parseFloat(request.amount || 0).toFixed(2)} BYN
                    </p>
                    <p className="text-gray-600 text-xs">
                      Дата запроса: {new Date(request.created_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {request.approved_at && (
                      <p className="text-brand-light text-xs mt-1">
                        Принято: {new Date(request.approved_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                    {request.rejected_at && (
                      <p className="text-red-400 text-xs mt-1">
                        Отклонено: {new Date(request.rejected_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={async () => {
                          if (!confirm(`Принять запрос на сдачу кассы от ${request.profiles?.full_name || 'водителя'} на сумму ${request.amount} BYN?`)) {
                            return
                          }
                          try {
                            const { data, error } = await supabase.rpc('approve_cash_deposit_request', {
                              request_id: request.id
                            })
                            
                            if (error) {
                              alert(`Ошибка: ${error.message}`)
                            } else if (data === false) {
                              alert('Не удалось принять запрос')
                            } else {
                              alert('Запрос принят! Деньги переведены на баланс организации.')
                              loadData()
                            }
                          } catch (err: any) {
                            alert(`Ошибка: ${err.message || 'Не удалось принять запрос'}`)
                          }
                        }}
                        className="bg-green-300 text-gray-900 px-4 py-2 rounded text-sm hover:bg-green-400 transition"
                      >
                        Принять
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Отклонить запрос на сдачу кассы от ${request.profiles?.full_name || 'водителя'}?`)) {
                            return
                          }
                          try {
                            const { data, error } = await supabase.rpc('reject_cash_deposit_request', {
                              request_id: request.id
                            })
                            
                            if (error) {
                              alert(`Ошибка: ${error.message}`)
                            } else if (data === false) {
                              alert('Не удалось отклонить запрос')
                            } else {
                              alert('Запрос отклонен')
                              loadData()
                            }
                          } catch (err: any) {
                            alert(`Ошибка: ${err.message || 'Не удалось отклонить запрос'}`)
                          }
                        }}
                        className="bg-red-300 text-gray-900 px-4 py-2 rounded text-sm hover:bg-red-400 transition"
                      >
                        Отклонить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Общая статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Водителей</h3>
          <p className="text-3xl font-bold text-gray-900">{totalDrivers}</p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Завершенных заказов</h3>
          <p className="text-3xl font-bold text-brand-light">{totalCompletedOrders}</p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Общая сумма</h3>
          <p className="text-3xl font-bold text-blue-400">{totalEarnings.toFixed(2)} BYN</p>
        </div>
        <div 
          className="bg-gray-50 rounded-lg shadow p-6 cursor-pointer hover:bg-gray-100 transition"
          onClick={() => {
            const receivablesSection = document.getElementById('receivables-section')
            if (receivablesSection) {
              receivablesSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
        >
          <h3 className="text-sm text-gray-600 mb-2">Дебиторка</h3>
          <p className="text-3xl font-bold text-red-400">{totalReceivables.toFixed(2)} BYN</p>
        </div>
      </div>

      {/* Финансы по водителям */}
      <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Финансы по водителям</h2>
        {finances && finances.length > 0 ? (
          <div className="space-y-4">
            {finances.map((finance: any) => (
              <div key={finance.driver_id} className="border border-gray-200 rounded-lg p-4 bg-gray-100">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-lg">{finance.driver_full_name || 'Без имени'}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-gray-700">
                        Завершенных заказов: <span className="text-gray-900 font-semibold">{finance.completed_orders_count || 0}</span>
                      </p>
                      <p className="text-gray-700">
                        Общая сумма: <span className="text-brand-light font-semibold">{parseFloat(finance.total_earnings || 0).toFixed(2)} BYN</span>
                      </p>
                      <p className="text-gray-700">
                        Баланс: <span className="text-blue-400 font-semibold">{parseFloat(finance.balance || 0).toFixed(2)} BYN</span>
                      </p>
                      {(() => {
                        // Фильтруем дебиторку по driver_user_id
                        const driverReceivables = receivables.filter((r: any) => {
                          // Проверяем, что driver_user_id совпадает с driver_id водителя
                          return r.driver_user_id === finance.driver_id
                        })
                        const driverReceivablesTotal = driverReceivables.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
                        if (driverReceivablesTotal > 0) {
                          return (
                            <p className="text-gray-700">
                              Дебиторка: <span className="text-red-400 font-semibold">{driverReceivablesTotal.toFixed(2)} BYN</span>
                              <span className="text-gray-500 text-xs ml-1">
                                ({driverReceivables.length} {driverReceivables.length === 1 ? 'заказ' : 'заказов'})
                              </span>
                            </p>
                          )
                        }
                        return null
                      })()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {parseFloat(finance.balance || 0) > 0 && (
                      <button
                        onClick={() => {
                          setSelectedDriver(finance)
                          setWithdrawAmount('')
                          setShowWithdrawModal(true)
                        }}
                        className="bg-green-300 text-gray-900 px-4 py-2 rounded text-sm hover:bg-green-400 transition"
                      >
                        Забрать кассу
                      </button>
                    )}
                    <a
                      href={`/dashboard/customer/drivers/${finance.driver_id}`}
                      className="bg-brand-light text-gray-900 px-4 py-2 rounded text-sm hover:bg-brand-dark transition"
                    >
                      Подробнее
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-8">Нет данных за выбранный период</p>
        )}
      </div>

      {/* Модальное окно изъятия кассы */}
      {showWithdrawModal && selectedDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-50 rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Забрать кассу у водителя</h2>
            <p className="text-gray-700 mb-2">
              Водитель: <span className="text-gray-900 font-semibold">{selectedDriver.driver_full_name || 'Без имени'}</span>
            </p>
            <p className="text-gray-700 mb-4">
              Доступный баланс водителя: <span className="text-brand-light font-semibold">
                {parseFloat(selectedDriver.balance || 0).toFixed(2)} BYN
              </span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Сумма для изъятия
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedDriver.balance || 0}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const amount = parseFloat(withdrawAmount)
                  if (!amount || amount <= 0) {
                    alert('Введите корректную сумму')
                    return
                  }
                  if (amount > parseFloat(selectedDriver.balance || 0)) {
                    alert('Недостаточно средств на балансе водителя')
                    return
                  }
                  
                  try {
                    const { data, error } = await supabase.rpc('withdraw_cash_from_driver', {
                      organization_user_id: user.id,
                      driver_user_id: selectedDriver.driver_id,
                      amount_to_withdraw: amount
                    })
                    
                    if (error) {
                      console.error('Ошибка изъятия кассы:', error)
                      alert(`Ошибка: ${error.message}`)
                    } else if (data === false) {
                      alert('Не удалось забрать кассу. Проверьте, что водитель привязан к вашей организации.')
                    } else {
                      alert('Касса успешно изъята!')
                      setShowWithdrawModal(false)
                      setSelectedDriver(null)
                      setWithdrawAmount('')
                      // Обновляем данные через 2 секунды
                      setTimeout(() => {
                        loadData()
                      }, 2000)
                    }
                  } catch (err: any) {
                    console.error('Ошибка изъятия кассы:', err)
                    alert(`Ошибка: ${err.message || 'Не удалось забрать кассу'}`)
                  }
                }}
                className="flex-1 bg-green-300 text-gray-900 px-4 py-2 rounded-md hover:bg-green-400 transition"
              >
                Забрать кассу
              </button>
              <button
                onClick={() => {
                  setShowWithdrawModal(false)
                  setSelectedDriver(null)
                  setWithdrawAmount('')
                }}
                className="flex-1 bg-gray-600 text-gray-900 px-4 py-2 rounded-md hover:bg-gray-100 transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Дебиторка */}
      <div id="receivables-section" className="bg-gray-50 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Дебиторка (неоплаченные заказы)</h2>
          <button
            onClick={() => {
              const filename = `Дебиторка_${new Date().toISOString().split('T')[0]}`
              exportReceivablesToExcel(receivables, filename)
            }}
            className="bg-brand-light hover:bg-brand-dark text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1"
            title="Экспорт дебиторки в Excel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Экспорт
          </button>
        </div>
        {debtorsList && debtorsList.length > 0 ? (
          <div className="space-y-4">
            {debtorsList.map((debtor: any) => {
              const isExpanded = expandedDebtors.has(debtor.debtor_user_id)
              return (
                <div key={debtor.debtor_user_id} className="border border-red-500/50 rounded-lg bg-gray-100/50">
                  {/* Заголовок должника */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-100 transition"
                    onClick={() => toggleDebtor(debtor.debtor_user_id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {debtor.debtor_organization_name && (
                            <p className="font-semibold text-gray-900 text-lg">
                              {debtor.debtor_organization_name}
                            </p>
                          )}
                          <p className="font-semibold text-gray-900 text-lg">
                            {debtor.debtor_name}
                          </p>
                          {debtor.debtor_phone && (
                            <a 
                              href={`tel:${debtor.debtor_phone}`} 
                              className="text-brand-light hover:text-brand-dark text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {debtor.debtor_phone}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <p className="text-gray-700">
                            Неоплаченных заказов: <span className="text-gray-900 font-semibold">{debtor.ordersCount}</span>
                          </p>
                          <p className="text-gray-700">
                            Общая сумма: <span className="text-red-400 font-semibold">{debtor.totalAmount.toFixed(2)} BYN</span>
                          </p>
                        </div>
                      </div>
                      <div className="ml-4 flex items-center gap-2">
                        <p className="text-xl font-bold text-red-400">
                          {debtor.totalAmount.toFixed(2)} BYN
                        </p>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!confirm(`Провести оплату по всем ${debtor.ordersCount} неоплаченным заказам клиента "${debtor.debtor_name}" на общую сумму ${debtor.totalAmount.toFixed(2)} BYN? Деньги будут начислены на баланс организации.`)) {
                              return
                            }
                            try {
                              let successCount = 0
                              let errorCount = 0
                              const errors: string[] = []

                              // Проводим оплату по каждому заказу должника
                              for (const receivable of debtor.receivables) {
                                if (!receivable.order_id) {
                                  errorCount++
                                  errors.push(`Заказ ${receivable.order_number || 'без номера'}: нет ID заказа`)
                                  continue
                                }

                                const orderUuid = String(receivable.order_id).trim()
                                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                                const isValidUuid = uuidRegex.test(orderUuid)

                                if (!isValidUuid) {
                                  errorCount++
                                  errors.push(`Заказ ${receivable.order_number || 'без номера'}: невалидный ID заказа`)
                                  continue
                                }

                                const { data, error } = await supabase.rpc('process_order_payment', {
                                  order_uuid: orderUuid,
                                  payment_status: true
                                })

                                if (error) {
                                  errorCount++
                                  errors.push(`Заказ ${receivable.order_number || 'без номера'}: ${error.message}`)
                                } else if (data === false) {
                                  errorCount++
                                  errors.push(`Заказ ${receivable.order_number || 'без номера'}: не удалось обработать оплату`)
                                } else {
                                  successCount++
                                }
                              }

                              if (successCount > 0) {
                                const message = errorCount > 0
                                  ? `Оплата проведена по ${successCount} заказам. Ошибок: ${errorCount}. ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`
                                  : `Оплата успешно проведена по всем ${successCount} заказам! Деньги начислены на баланс организации.`
                                alert(message)
                                setTimeout(() => {
                                  loadData()
                                }, 2000)
                              } else {
                                alert(`Не удалось провести оплату ни по одному заказу. Ошибки: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? '...' : ''}`)
                              }
                            } catch (err: any) {
                              console.error('Ошибка обработки оплаты:', err)
                              alert(`Ошибка: ${err.message || 'Не удалось обработать оплату'}`)
                            }
                          }}
                          className="bg-green-300 text-gray-900 px-4 py-2 rounded text-sm hover:bg-green-400 transition whitespace-nowrap"
                        >
                          Провести оплату
                        </button>
                        <svg 
                          className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Раскрывающийся список заказов */}
                  {isExpanded && (
                    <div className="border-t border-red-500/30 p-4 space-y-3">
                      {debtor.receivables.map((receivable: any) => (
                        <div key={receivable.id} className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p 
                                  className="font-semibold text-gray-900 text-lg cursor-pointer hover:text-blue-400 transition"
                                  onClick={() => {
                                    if (receivable.order_id) {
                                      router.push(`/dashboard/customer/orders/${receivable.order_id}`)
                                    }
                                  }}
                                >
                                  Заказ {receivable.order_number ? `№${receivable.order_number}` : 'без номера'}
                                </p>
                                <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                                  Не оплачен
                                </span>
                              </div>
                              <div className="mt-2 space-y-1 text-sm">
                                <p className="text-gray-700">
                                  Сумма: <span className="text-red-400 font-semibold">{parseFloat(receivable.amount || 0).toFixed(2)} BYN</span>
                                </p>
                                <p className="text-gray-700">
                                  Водитель: <span className="text-gray-900">{receivable.driver_full_name || 'Неизвестно'}</span>
                                </p>
                                {receivable.pickup_address && (
                                  <p className="text-gray-600 text-xs mt-1">
                                    Откуда: {receivable.pickup_address}
                                  </p>
                                )}
                                {receivable.delivery_address && (
                                  <p className="text-gray-600 text-xs">
                                    Куда: {receivable.delivery_address}
                                  </p>
                                )}
                                <p className="text-gray-600 text-xs mt-1">
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
                            <div className="ml-4 flex flex-col items-end">
                              <p className="text-xl font-bold text-red-400 mb-2">
                                {parseFloat(receivable.amount || 0).toFixed(2)} BYN
                              </p>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (!confirm(`Провести оплату заказа №${receivable.order_number || 'без номера'}? Деньги будут начислены на баланс организации.`)) {
                                    return
                                  }
                                  try {
                                    if (!receivable.order_id) {
                                      alert('Ошибка: Нет ID заказа. Пожалуйста, обновите страницу.')
                                      return
                                    }
                                    
                                    const orderUuid = String(receivable.order_id).trim()
                                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                                    const isValidUuid = uuidRegex.test(orderUuid)
                                    
                                    if (!isValidUuid) {
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
                                      alert('Оплата успешно проведена! Деньги начислены на баланс организации.')
                                      setTimeout(() => {
                                        loadData()
                                      }, 2000)
                                    }
                                  } catch (err: any) {
                                    console.error('Ошибка обработки оплаты:', err)
                                    alert(`Ошибка: ${err.message || 'Не удалось обработать оплату'}`)
                                  }
                                }}
                                className="bg-brand-light text-gray-900 px-4 py-2 rounded text-sm hover:bg-brand-dark transition"
                              >
                                Провести оплату
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-2">Нет дебиторки за выбранный период</p>
            <p className="text-gray-500 text-sm">
              Дебиторка появляется, когда водитель отмечает заказ как "не оплачен" после завершения доставки
            </p>
          </div>
        )}
      </div>

      {/* Модальное окно информации о должнике */}
      {showDebtorModal && selectedDebtor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-50 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Информация о должнике</h2>
              <button
                onClick={() => {
                  setShowDebtorModal(false)
                  setSelectedDebtor(null)
                  setDebtorReceivables([])
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {selectedDebtor.organization_name && (
                <div>
                  <p className="text-sm text-gray-600">Наименование организации</p>
                  <p className="text-gray-900 font-semibold text-lg">{selectedDebtor.organization_name}</p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-600">ФИО</p>
                <p className="text-gray-900 font-semibold text-lg">{selectedDebtor.name || 'Не указано'}</p>
              </div>
              
              {selectedDebtor.phone && (
                <div>
                  <p className="text-sm text-gray-600">Телефон</p>
                  <p className="text-gray-900">
                    <a href={`tel:${selectedDebtor.phone}`} className="text-brand-light hover:text-brand-dark font-medium">
                      {selectedDebtor.phone}
                    </a>
                  </p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-600">Тип</p>
                <p className="text-gray-900 capitalize">
                  {selectedDebtor.type === 'sender' ? 'Отправитель' : 'Получатель'}
                </p>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600 mb-2">Общая сумма задолженности</p>
                <p className="text-3xl font-bold text-red-400">
                  {debtorReceivables.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0).toFixed(2)} BYN
                </p>
                <p className="text-gray-600 text-sm mt-1">
                  ({debtorReceivables.length} {debtorReceivables.length === 1 ? 'неоплаченный заказ' : 'неоплаченных заказов'})
                </p>
              </div>
              
              {debtorReceivables.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Неоплаченные заказы</h3>
                  <div className="space-y-2">
                    {debtorReceivables.map((r: any) => (
                      <div 
                        key={r.id} 
                        className="bg-gray-100/50 rounded p-3 cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => {
                          if (r.order_id) {
                            router.push(`/dashboard/customer/orders/${r.order_id}`)
                          }
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-gray-900 font-medium">
                              Заказ {r.order_number ? `№${r.order_number}` : 'без номера'}
                            </p>
                            {r.pickup_address && r.delivery_address && (
                              <p className="text-gray-600 text-xs mt-1">
                                {r.pickup_address} → {r.delivery_address}
                              </p>
                            )}
                            <p className="text-gray-600 text-xs mt-1">
                              {new Date(r.created_at).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                          <p className="text-red-400 font-semibold">
                            {parseFloat(r.amount || 0).toFixed(2)} BYN
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
        {transactions && transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((transaction: any) => (
              <div key={transaction.id} className="border-b border-gray-200 pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">
                      {transaction.description}
                      {transaction.profiles && (
                        <span className="text-sm text-gray-600 ml-2">
                          ({transaction.profiles.full_name || 'Водитель'})
                        </span>
                      )}
                    </p>
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
          <p className="text-gray-600">Нет транзакций</p>
        )}
      </div>
      
    </div>
  )
}

