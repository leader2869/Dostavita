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
  const [balance, setBalance] = useState<any>(null)
  const [finances, setFinances] = useState<any[]>([])
  const [receivables, setReceivables] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<any>(null)
  const [withdrawAmount, setWithdrawAmount] = useState<string>('')
  const [cashDepositRequests, setCashDepositRequests] = useState<any[]>([])
  const [showDebtorModal, setShowDebtorModal] = useState(false)
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null)
  const [debtorReceivables, setDebtorReceivables] = useState<any[]>([])

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
      
      // Загружаем запросы на сдачу кассы от водителей
      const { data: requestsData } = await supabase
        .from('cash_deposit_requests')
        .select(`
          *,
          profiles!cash_deposit_requests_driver_user_id_fkey(full_name)
        `)
        .eq('organization_id', currentUser.id)
        .order('created_at', { ascending: false })
      
      setCashDepositRequests(requestsData || [])
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

      {/* Баланс организации */}
      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Баланс организации</h2>
        <p className="text-3xl font-bold text-green-600">
          {balance?.amount ? parseFloat(balance.amount).toFixed(2) : '0.00'} {balance?.currency || 'BYN'}
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Сумма, полученная от водителей (сдача кассы)
        </p>
      </div>

      {/* Общая статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
        <div 
          className="bg-gray-800 rounded-lg shadow p-6 cursor-pointer hover:bg-gray-700 transition"
          onClick={() => {
            const receivablesSection = document.getElementById('receivables-section')
            if (receivablesSection) {
              receivablesSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
        >
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
                      {(() => {
                        // Фильтруем дебиторку по driver_user_id
                        const driverReceivables = receivables.filter((r: any) => {
                          // Проверяем, что driver_user_id совпадает с driver_id водителя
                          return r.driver_user_id === finance.driver_id
                        })
                        const driverReceivablesTotal = driverReceivables.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
                        if (driverReceivablesTotal > 0) {
                          return (
                            <p className="text-gray-300">
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
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
                      >
                        Забрать кассу
                      </button>
                    )}
                    <a
                      href={`/dashboard/customer/drivers/${finance.driver_id}`}
                      className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
                    >
                      Подробнее
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">Нет данных за выбранный период</p>
        )}
      </div>

      {/* Модальное окно изъятия кассы */}
      {showWithdrawModal && selectedDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-white">Забрать кассу у водителя</h2>
            <p className="text-gray-300 mb-2">
              Водитель: <span className="text-white font-semibold">{selectedDriver.driver_full_name || 'Без имени'}</span>
            </p>
            <p className="text-gray-300 mb-4">
              Доступный баланс водителя: <span className="text-green-400 font-semibold">
                {parseFloat(selectedDriver.balance || 0).toFixed(2)} BYN
              </span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
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
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
              >
                Забрать кассу
              </button>
              <button
                onClick={() => {
                  setShowWithdrawModal(false)
                  setSelectedDriver(null)
                  setWithdrawAmount('')
                }}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Дебиторка */}
      <div id="receivables-section" className="bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Дебиторка (неоплаченные заказы)</h2>
        {receivables && receivables.length > 0 ? (
          <div className="space-y-4">
            {receivables.map((receivable: any) => (
              <div key={receivable.id} className="border border-red-500/50 rounded-lg p-4 bg-gray-700/50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p 
                        className="font-semibold text-white text-lg cursor-pointer hover:text-blue-400 transition"
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
                      <p className="text-gray-300">
                        Сумма: <span className="text-red-400 font-semibold">{parseFloat(receivable.amount || 0).toFixed(2)} BYN</span>
                      </p>
                      <p className="text-gray-300">
                        Должник: <span className="text-white font-semibold capitalize">
                          {receivable.debtor_type === 'sender' ? 'Отправитель' : 'Получатель'}
                        </span>
                        {receivable.debtor_name && (
                          <span 
                            className="text-blue-400 ml-1 cursor-pointer hover:text-blue-300 underline"
                            onClick={async () => {
                              // Загружаем все неоплаченные заказы этого должника
                              const { data: debtorReceivablesData } = await supabase
                                .rpc('get_organization_receivables', {
                                  organization_user_id: user.id,
                                  start_date: null,
                                  end_date: null
                                })
                              
                              const filtered = (debtorReceivablesData || []).filter((r: any) => 
                                r.debtor_user_id === receivable.debtor_user_id
                              )
                              
                              setDebtorReceivables(filtered)
                              setSelectedDebtor({
                                name: receivable.debtor_name,
                                phone: receivable.debtor_phone,
                                type: receivable.debtor_type,
                                user_id: receivable.debtor_user_id
                              })
                              setShowDebtorModal(true)
                            }}
                          >
                            ({receivable.debtor_name})
                          </span>
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
                  <div className="ml-4 flex flex-col items-end">
                    <p className="text-xl font-bold text-red-400 mb-2">
                      {parseFloat(receivable.amount || 0).toFixed(2)} BYN
                    </p>
                    <button
                      onClick={async () => {
                        if (!confirm(`Провести оплату заказа №${receivable.order_number || 'без номера'}? Деньги будут начислены на баланс организации.`)) {
                          return
                        }
                        try {
                          console.log('=== ПРОВЕДЕНИЕ ОПЛАТЫ (ОРГАНИЗАЦИЯ) ===')
                          console.log('Полный объект receivable:', JSON.stringify(receivable, null, 2))
                          console.log('receivable.order_id:', receivable.order_id)
                          console.log('receivable.order_id type:', typeof receivable.order_id)
                          console.log('receivable.order_id length:', receivable.order_id?.length)
                          console.log('receivable.id:', receivable.id)
                          console.log('receivable.order_number:', receivable.order_number)
                          
                          if (!receivable.order_id) {
                            console.error('❌ receivable.order_id отсутствует!')
                            alert('Ошибка: Нет ID заказа. Пожалуйста, обновите страницу.')
                            return
                          }
                          
                          const orderUuid = String(receivable.order_id).trim()
                          console.log('orderUuid после String().trim():', orderUuid)
                          console.log('orderUuid length:', orderUuid.length)
                          console.log('orderUuid type:', typeof orderUuid)
                          
                          // Проверяем, что UUID валиден
                          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                          const isValidUuid = uuidRegex.test(orderUuid)
                          console.log('UUID валиден:', isValidUuid)
                          
                          if (!isValidUuid) {
                            console.error('❌ UUID невалиден!')
                            console.error('orderUuid:', orderUuid)
                            console.error('orderUuid length:', orderUuid.length)
                            alert(`Ошибка: Невалидный ID заказа (${orderUuid}). Пожалуйста, обновите страницу.`)
                            return
                          }
                          
                          console.log('✅ UUID валиден, вызываем RPC')
                          console.log('Параметры RPC:', {
                            order_uuid: orderUuid,
                            payment_status: true
                          })
                          
                          // Передаем только 2 параметра: order_uuid и payment_status
                          const { data, error } = await supabase.rpc('process_order_payment', {
                            order_uuid: orderUuid,
                            payment_status: true
                          })
                          
                          console.log('RPC результат:', { data, error })
                          
                          if (error) {
                            console.error('RPC error details:', error)
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
                      className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
                    >
                      Провести оплату
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-2">Нет дебиторки за выбранный период</p>
            <p className="text-gray-500 text-sm">
              Дебиторка появляется, когда водитель отмечает заказ как "не оплачен" после завершения доставки
            </p>
          </div>
        )}
      </div>

      {/* Запросы на сдачу кассы от водителей */}
      {cashDepositRequests.length > 0 && (
        <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Запросы на сдачу кассы</h2>
          <div className="space-y-3">
            {cashDepositRequests.map((request: any) => (
              <div key={request.id} className="border border-blue-500/50 rounded-lg p-4 bg-gray-700/50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold text-white text-lg">
                        {request.profiles?.full_name || 'Водитель без имени'}
                      </p>
                      <span className={`px-2 py-1 text-xs rounded ${
                        request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        request.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        request.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
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
                    <p className="text-gray-400 text-xs">
                      Дата запроса: {new Date(request.created_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {request.approved_at && (
                      <p className="text-green-400 text-xs mt-1">
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
                        className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
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
                        className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition"
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

      {/* Модальное окно информации о должнике */}
      {showDebtorModal && selectedDebtor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Информация о должнике</h2>
              <button
                onClick={() => {
                  setShowDebtorModal(false)
                  setSelectedDebtor(null)
                  setDebtorReceivables([])
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">Имя</p>
                <p className="text-white font-semibold text-lg">{selectedDebtor.name || 'Не указано'}</p>
              </div>
              
              {selectedDebtor.phone && (
                <div>
                  <p className="text-sm text-gray-400">Телефон</p>
                  <p className="text-white">
                    <a href={`tel:${selectedDebtor.phone}`} className="text-green-400 hover:text-green-300 font-medium">
                      {selectedDebtor.phone}
                    </a>
                  </p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-400">Тип</p>
                <p className="text-white capitalize">
                  {selectedDebtor.type === 'sender' ? 'Отправитель' : 'Получатель'}
                </p>
              </div>
              
              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-400 mb-2">Общая сумма задолженности</p>
                <p className="text-3xl font-bold text-red-400">
                  {debtorReceivables.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0).toFixed(2)} BYN
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  ({debtorReceivables.length} {debtorReceivables.length === 1 ? 'неоплаченный заказ' : 'неоплаченных заказов'})
                </p>
              </div>
              
              {debtorReceivables.length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-lg font-semibold text-white mb-3">Неоплаченные заказы</h3>
                  <div className="space-y-2">
                    {debtorReceivables.map((r: any) => (
                      <div 
                        key={r.id} 
                        className="bg-gray-700/50 rounded p-3 cursor-pointer hover:bg-gray-700 transition"
                        onClick={() => {
                          if (r.order_id) {
                            router.push(`/dashboard/customer/orders/${r.order_id}`)
                          }
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-white font-medium">
                              Заказ {r.order_number ? `№${r.order_number}` : 'без номера'}
                            </p>
                            {r.pickup_address && r.delivery_address && (
                              <p className="text-gray-400 text-xs mt-1">
                                {r.pickup_address} → {r.delivery_address}
                              </p>
                            )}
                            <p className="text-gray-400 text-xs mt-1">
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

