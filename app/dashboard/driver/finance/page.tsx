'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDateFilter } from '@/hooks/useDateFilter'
import { fetchOrCreateBalance } from '@/lib/utils/balance'
import { toastError, toastSuccess } from '@/lib/utils/toast'
import { useDashboardUser } from '@/contexts/DashboardAuthContext'

export default function DriverFinancePage() {
  const supabase = createClient()
  const { userId, profile } = useDashboardUser()
  const organizationId = (profile as { organization_id?: string }).organization_id
  const {
    period,
    setPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    getDateFilter,
  } = useDateFilter('week')

  const [balance, setBalance] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [unpaidOrdersFromReceivables, setUnpaidOrdersFromReceivables] = useState<any[]>([])
  const [allUnpaidCompletedOrders, setAllUnpaidCompletedOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [depositAmount, setDepositAmount] = useState<string>('')
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [cashDepositRequests, setCashDepositRequests] = useState<any[]>([])
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'credit' | 'debit'>('all')
  const [displayedTransactionsCount, setDisplayedTransactionsCount] = useState(10)
  const [unpaidOrderSearch, setUnpaidOrderSearch] = useState<string>('')
  const [displayedUnpaidOrdersCount, setDisplayedUnpaidOrdersCount] = useState(5)

  const loadData = useCallback(async () => {
    let isMounted = true
    
    try {
      if (!isMounted) return

      const balanceData = await fetchOrCreateBalance(supabase, userId)
      if (isMounted) setBalance(balanceData)

      // Получаем транзакции с фильтром по периоду
      const dateFilter = getDateFilter()
      let transactionsQuery = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

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
        setDisplayedTransactionsCount(10) // Сбрасываем счетчик при загрузке новых данных
      }

      // Получаем завершенные заказы с фильтром по периоду для статистики
      let ordersQuery = supabase
        .from('orders')
        .select('id, order_number, final_price, completed_at, is_paid, pickup_address, delivery_address, created_at')
        .eq('executor_user_id', userId)
        .eq('status', 'completed')

      if (dateFilter.start) {
        ordersQuery = ordersQuery.gte('completed_at', dateFilter.start)
      }
      if (dateFilter.end) {
        ordersQuery = ordersQuery.lte('completed_at', dateFilter.end)
      }

      const { data: ordersData, error: ordersError } = await ordersQuery
      
      // Получаем неоплаченные заказы из receivables по driver_user_id (БЕЗ фильтра по дате)
      let receivablesQuery = supabase
        .from('receivables')
        .select('id, order_id, amount, currency, status, created_at')
        .eq('driver_user_id', userId)
        .eq('status', 'unpaid')
      
      // УБИРАЕМ фильтр по дате для receivables, чтобы показывать все неоплаченные заказы
      // if (dateFilter.start) {
      //   receivablesQuery = receivablesQuery.gte('created_at', dateFilter.start)
      // }
      // if (dateFilter.end) {
      //   receivablesQuery = receivablesQuery.lte('created_at', dateFilter.end)
      // }
      
      const { data: receivablesData, error: receivablesError } = await receivablesQuery
      
      // Также загружаем все завершенные неоплаченные заказы (БЕЗ фильтра по дате)
      const { data: allUnpaidCompletedOrders, error: unpaidOrdersError } = await supabase
        .from('orders')
        .select('id, order_number, final_price, completed_at, is_paid, pickup_address, delivery_address, created_at')
        .eq('executor_user_id', userId)
        .eq('status', 'completed')
        .or('is_paid.is.null,is_paid.eq.false')
      
      // Получаем данные заказов для receivables
      let receivablesWithOrders: any[] = []
      if (receivablesData && receivablesData.length > 0) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const orderIds = receivablesData
          .map((r: any) => {
            if (!r.order_id) return null
            const isValid = uuidRegex.test(String(r.order_id))
            return isValid ? r.order_id : null
          })
          .filter((id: any): id is string => id !== null)
        
        if (orderIds.length > 0) {
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('id, order_number, final_price, completed_at, is_paid, pickup_address, delivery_address, created_at')
            .in('id', orderIds)
          
          if (ordersError) {
            console.error('Ошибка загрузки заказов для receivables:', ordersError)
          } else {
            // Объединяем receivables с orders
            receivablesWithOrders = receivablesData.map((receivable: any) => {
              const order = ordersData?.find((o: any) => o.id === receivable.order_id)
              return {
                ...receivable,
                orders: order
              }
            })
          }
        }
      }
      
      if (isMounted) {
        setCompletedOrders(ordersData || [])
        // Сохраняем receivables с данными заказов для отображения неоплаченных заказов
        setUnpaidOrdersFromReceivables(receivablesWithOrders || [])
        // Сохраняем все неоплаченные завершенные заказы в отдельное состояние
        setAllUnpaidCompletedOrders(allUnpaidCompletedOrders || [])
        
        // Загружаем запросы на сдачу кассы
        if (organizationId) {
          const { data: requestsData, error: requestsError } = await supabase
            .from('cash_deposit_requests')
            .select('*')
            .eq('driver_user_id', userId)
            .order('created_at', { ascending: false })
          
          if (requestsError) {
            console.error('Ошибка загрузки запросов на сдачу кассы:', requestsError)
          }
          
          if (isMounted) {
            setCashDepositRequests(requestsData || [])
          }
        }
        
        setLoading(false)
      }
    } catch (err: any) {
      if (isMounted) {
        console.error('Ошибка загрузки данных:', err)
        setLoading(false)
      }
    }
  }, [period, getDateFilter, customStartDate, customEndDate, supabase, userId, organizationId])

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
  
  // Неоплаченные заказы: берем из receivables И из завершенных заказов с is_paid = false/null
  // Преобразуем данные из receivables в формат для отображения
  const unpaidOrdersFromReceivablesList = (unpaidOrdersFromReceivables || []).map((receivable: any) => {
    const order = receivable.orders
    if (!order || !order.id) return null
    
    return {
      id: order.id,
      order_number: order.order_number,
      final_price: receivable.amount || order.final_price,
      completed_at: order.completed_at,
      is_paid: order.is_paid,
      pickup_address: order.pickup_address,
      delivery_address: order.delivery_address,
      created_at: order.created_at,
      receivable_id: receivable.id,
    }
  }).filter((order: any) => {
    if (!order || !order.id) return false
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(String(order.id))
  })
  
  // Также проверяем завершенные заказы с is_paid = false/null (используем отдельно загруженные данные)
  const unpaidOrdersFromCompleted = (allUnpaidCompletedOrders || []).map((order: any) => ({
    id: order.id,
    order_number: order.order_number,
    final_price: order.final_price,
    completed_at: order.completed_at,
    is_paid: order.is_paid,
    pickup_address: order.pickup_address,
    delivery_address: order.delivery_address,
    created_at: order.created_at,
    receivable_id: null
  }))
  
  // Объединяем оба списка, убирая дубликаты по order.id
  const allUnpaidOrders = [...unpaidOrdersFromReceivablesList, ...unpaidOrdersFromCompleted]
  const uniqueUnpaidOrdersMap = new Map()
  allUnpaidOrders.forEach((order: any) => {
    if (order && order.id) {
      // Если заказ уже есть, приоритет у того, что из receivables (имеет receivable_id)
      if (!uniqueUnpaidOrdersMap.has(order.id) || order.receivable_id) {
        uniqueUnpaidOrdersMap.set(order.id, order)
      }
    }
  })
  const unpaidOrders = Array.from(uniqueUnpaidOrdersMap.values())
  
  const unpaidAmount = unpaidOrders.reduce((sum, order) => sum + (parseFloat(order.final_price) || 0), 0) || 0
  
  // Фильтруем неоплаченные заказы по поисковому запросу
  const filteredUnpaidOrders = unpaidOrders.filter((order: any) => {
    if (!unpaidOrderSearch.trim()) return true
    const searchTerm = unpaidOrderSearch.toLowerCase().trim()
    const orderNumber = String(order.order_number || order.id?.slice(0, 8) || '').toLowerCase()
    return orderNumber.includes(searchTerm)
  })
  
  // Ограничиваем количество отображаемых неоплаченных заказов
  const displayedUnpaidOrders = filteredUnpaidOrders.slice(0, displayedUnpaidOrdersCount)
  const hasMoreUnpaidOrders = filteredUnpaidOrders.length > displayedUnpaidOrdersCount
  
  // Сбрасываем счетчик при смене поискового запроса
  useEffect(() => {
    setDisplayedUnpaidOrdersCount(5)
  }, [unpaidOrderSearch])

  if (loading) {
    return (
      <div className="pb-20">
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="pb-20">

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
            onClick={() => setPeriod('custom')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'custom'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            ...
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
          
          {/* Информация о запросах, ожидающих подтверждения */}
          {(() => {
            const pendingRequests = cashDepositRequests.filter((r: any) => r.status === 'pending')
            const pendingAmount = pendingRequests.reduce((sum: number, r: any) => sum + parseFloat(r.amount || 0), 0)
            
            if (pendingAmount > 0) {
              return (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Отправлено на запрос:</span>{' '}
                    <span className="text-yellow-600 font-bold">{pendingAmount.toFixed(2)} BYN</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">⏳ Ожидает подтверждения</p>
                  <div className="mt-2 space-y-2">
                    {pendingRequests.map((request: any) => (
                      <div key={request.id} className="flex justify-between items-center bg-white/50 rounded p-2">
                        <div className="flex-1">
                          <p className="text-xs text-gray-700">
                            {request.amount} BYN • {new Date(request.created_at).toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm('Отменить запрос на сдачу кассы?')) return
                            try {
                              const { error } = await supabase.rpc('cancel_cash_deposit_request', {
                                request_id: request.id
                              })
                              if (error) {
                                toastError(error.message)
                              } else {
                                loadData()
                              }
                            } catch (err: any) {
                              toastError(err.message)
                            }
                          }}
                          className="text-red-400 hover:text-red-300 text-xs font-medium ml-2"
                        >
                          Отменить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
            return null
          })()}
          
          {organizationId && (
            <>
              <button
                onClick={() => setShowDepositModal(true)}
                className="mt-4 w-full bg-green-300 text-gray-900 px-4 py-2 rounded-md hover:bg-green-400 transition"
              >
                Отправить запрос на сдачу кассы
              </button>
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
          <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-900">Неоплаченные заказы</h2>
            <input
              type="text"
              placeholder="Поиск по номеру заказа..."
              value={unpaidOrderSearch}
              onChange={(e) => setUnpaidOrderSearch(e.target.value)}
              className="flex-1 min-w-[200px] max-w-[300px] px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-light"
            />
          </div>
          <div className="space-y-3">
            {displayedUnpaidOrders.length > 0 ? (
              displayedUnpaidOrders.map((order: any) => (
              <div key={order.id} className="border border-gray-200 rounded-lg p-4 bg-red-100/40">
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
                            toastError('Невалидный ID заказа. Пожалуйста, обновите страницу.')
                            return
                          }
                          
                          const { data, error } = await supabase.rpc('process_order_payment', {
                            order_uuid: orderUuid,
                            payment_status: true
                          })
                          
                          if (error) {
                            toastError(error.message)
                          } else if (data === false) {
                            toastError('Не удалось обработать оплату. Возможно, заказ уже обработан или не найден.')
                          } else {
                            toastSuccess('Оплата успешно принята! Деньги начислены на ваш баланс.')
                            setTimeout(() => {
                              loadData()
                            }, 2000)
                          }
                        } catch (err: any) {
                          toastError(err.message || 'Не удалось обработать оплату')
                        }
                      }}
                      className="mt-2 bg-green-300 text-gray-900 px-3 py-1.5 rounded text-sm hover:bg-green-400 transition"
                    >
                      Принять оплату
                    </button>
                  </div>
                </div>
              </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-600">
                {unpaidOrderSearch.trim() ? 'Заказы с таким номером не найдены' : 'Нет неоплаченных заказов'}
              </div>
            )}
            {hasMoreUnpaidOrders && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setDisplayedUnpaidOrdersCount(prev => prev + 5)}
                  className="bg-brand-light hover:bg-brand-dark text-gray-900 px-6 py-2 rounded-md transition"
                >
                  Загрузить еще
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно сдачи кассы */}
      {showDepositModal && (() => {
        const pendingRequests = cashDepositRequests.filter((r: any) => r.status === 'pending')
        const pendingAmount = pendingRequests.reduce((sum: number, r: any) => sum + parseFloat(r.amount || 0), 0)
        const availableBalance = parseFloat(balance?.amount || 0) - pendingAmount
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-50 rounded-lg shadow-xl p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Запрос на сдачу кассы</h2>
              <p className="text-gray-700 mb-2">
                <span className="text-green-600 font-semibold">Доступный баланс:</span> <span className="text-green-600 font-semibold">
                  {balance?.amount ? parseFloat(balance.amount).toFixed(2) : '0.00'} BYN
                </span>
              </p>
              {pendingAmount > 0 && (
                <p className="text-gray-600 text-sm mb-1">
                  Уже отправлено на запрос: <span className="font-semibold">{pendingAmount.toFixed(2)} BYN</span>
                </p>
              )}
              <p className="text-gray-600 text-sm mb-2">
                Доступно для нового запроса: <span className="font-semibold text-green-600">{availableBalance.toFixed(2)} BYN</span>
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
                  max={availableBalance}
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
                    toastError('Введите корректную сумму')
                    return
                  }
                  // Проверяем доступный баланс с учетом уже отправленных запросов
                  const pendingRequests = cashDepositRequests.filter((r: any) => r.status === 'pending')
                  const pendingAmount = pendingRequests.reduce((sum: number, r: any) => sum + parseFloat(r.amount || 0), 0)
                  const availableBalance = parseFloat(balance?.amount || 0) - pendingAmount
                  
                  if (amount > availableBalance) {
                    toastError(`Недостаточно средств. Доступно для нового запроса: ${availableBalance.toFixed(2)} BYN`)
                    return
                  }
                  
                  try {
                    const { data: requestId, error } = await supabase.rpc('deposit_cash_to_organization', {
                      driver_user_id: userId,
                      amount_to_deposit: amount
                    })
                    
                    if (error) {
                      console.error('Ошибка создания запроса:', error)
                      toastError(error.message)
                    } else {
                      toastSuccess('Запрос на сдачу кассы отправлен! Деньги останутся на вашем балансе до принятия запроса организацией.')
                      setShowDepositModal(false)
                      setDepositAmount('')
                      loadData()
                    }
                  } catch (err: any) {
                    console.error('Ошибка создания запроса:', err)
                    toastError(err.message || 'Не удалось создать запрос')
                  }
                }}
                className="flex-1 bg-green-300 text-gray-900 px-4 py-2 rounded-md hover:bg-green-400 transition"
              >
                Отправить запрос
              </button>
              <button
                onClick={() => {
                  setShowDepositModal(false)
                  setDepositAmount('')
                }}
                className="flex-1 bg-red-300 text-gray-900 px-4 py-2 rounded-md hover:bg-red-400 transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Транзакции */}
      <div className="bg-gray-50 rounded-lg shadow p-6 mt-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">История транзакций</h2>
        </div>
        
        {/* Фильтр транзакций */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setTransactionFilter('all')
              setDisplayedTransactionsCount(10) // Сбрасываем счетчик при смене фильтра
            }}
            className={`px-4 py-2 rounded-md transition text-sm ${
              transactionFilter === 'all'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Все операции
          </button>
          <button
            onClick={() => {
              setTransactionFilter('credit')
              setDisplayedTransactionsCount(10) // Сбрасываем счетчик при смене фильтра
            }}
            className={`px-4 py-2 rounded-md transition text-sm ${
              transactionFilter === 'credit'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Только приход
          </button>
          <button
            onClick={() => {
              setTransactionFilter('debit')
              setDisplayedTransactionsCount(10) // Сбрасываем счетчик при смене фильтра
            }}
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
          
          const displayedTransactions = filteredTransactions.slice(0, displayedTransactionsCount)
          const hasMore = filteredTransactions.length > displayedTransactionsCount
          
          return filteredTransactions && filteredTransactions.length > 0 ? (
            <>
              <div className="space-y-2">
                {displayedTransactions.map((transaction: any) => (
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
              {hasMore && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setDisplayedTransactionsCount(prev => prev + 10)}
                    className="bg-brand-light hover:bg-brand-dark text-gray-900 px-6 py-2 rounded-md transition"
                  >
                    Загрузить еще
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-600">
              {transactions && transactions.length > 0 
                ? 'Нет транзакций по выбранному фильтру' 
                : 'Нет транзакций'}
            </p>
          )
        })()}
      </div>
    </div>
  )
}
