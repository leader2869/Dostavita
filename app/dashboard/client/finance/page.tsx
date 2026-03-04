'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { exportReceivablesToExcel } from '@/lib/utils/exportToExcel'
import { useDateFilter } from '@/hooks/useDateFilter'
import { useDashboardUser } from '@/contexts/DashboardAuthContext'

export default function ClientFinancePage() {
  const router = useRouter()
  const supabase = createClient()
  const { userId } = useDashboardUser()
  const {
    period,
    setPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    getDateFilter,
  } = useDateFilter('week')

  const [receivables, setReceivables] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [displayedTransactionsCount, setDisplayedTransactionsCount] = useState(10)
  const [expandedOrganizations, setExpandedOrganizations] = useState<Set<string>>(new Set())
  const [displayedOrdersCount, setDisplayedOrdersCount] = useState<Record<string, number>>({})

  const loadData = useCallback(async () => {
    try {
      const dateFilter = getDateFilter()

      // Получаем дебиторку клиента (всегда за все время)
      const { data: receivablesData, error: receivablesError } = await supabase
        .rpc('get_client_receivables', {
          client_user_id: userId,
          start_date: null,
          end_date: null
        })

      if (receivablesError) {
        console.error('Ошибка загрузки дебиторки:', receivablesError)
        setReceivables([])
      } else {
        setReceivables(receivablesData || [])
      }

      // Получаем транзакции через RPC функцию, которая обходит RLS
      const { data: transactionsData, error: transactionsError } = await supabase
        .rpc('get_client_transactions', {
          client_user_id: userId,
          start_date: dateFilter.start,
          end_date: dateFilter.end
        })

      if (transactionsError) {
        console.error('Ошибка загрузки транзакций:', transactionsError)
        setTransactions([])
      } else {
        // Преобразуем данные в формат, ожидаемый компонентом
        const formattedTransactions = (transactionsData || []).map((t: any) => ({
          id: t.id,
          user_id: t.user_id,
          order_id: t.order_id,
          amount: t.amount,
          type: t.type,
          description: t.description,
          created_at: t.created_at,
          related_user_id: t.related_user_id,
          order: t.order_id ? {
            id: t.order_id,
            order_number: t.order_number,
            final_price: t.order_final_price,
            customer_id: t.order_customer_id,
            client_id: t.order_client_id
          } : null
        }))
        

        setTransactions(formattedTransactions)
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
      setLoading(false)
    }
  }, [supabase, userId, period, customStartDate, customEndDate, getDateFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Сбрасываем счетчик при смене периода или фильтров
  useEffect(() => {
    setDisplayedTransactionsCount(10)
    setExpandedOrganizations(new Set())
    setDisplayedOrdersCount({})
  }, [period, customStartDate, customEndDate])

  const toggleOrganization = (orgId: string) => {
    setExpandedOrganizations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orgId)) {
        newSet.delete(orgId)
      } else {
        newSet.add(orgId)
        // Инициализируем счетчик для этой организации, если его еще нет
        if (!displayedOrdersCount[orgId]) {
          setDisplayedOrdersCount(prev => ({ ...prev, [orgId]: 10 }))
        }
      }
      return newSet
    })
  }

  const loadMoreOrders = (orgId: string, currentCount: number, totalCount: number) => {
    setDisplayedOrdersCount(prev => ({
      ...prev,
      [orgId]: Math.min(currentCount + 10, totalCount)
    }))
  }

  // Группируем дебиторку по организациям
  const receivablesByOrganization = receivables.reduce((acc: any, r: any) => {
    const orgId = r.organization_id || 'unknown'
    if (!acc[orgId]) {
      acc[orgId] = {
        organization_id: r.organization_id,
        organization_name: r.organization_name || 'Неизвестная организация',
        receivables: [],
        total: 0
      }
    }
    acc[orgId].receivables.push(r)
    acc[orgId].total += parseFloat(r.amount || 0)
    return acc
  }, {})

  const totalReceivables = receivables.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

  if (loading) {
    return (
      <div className="pb-20">
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }


  const handleExportReceivables = () => {
    const filename = `Дебиторка_${new Date().toISOString().split('T')[0]}`
    exportReceivablesToExcel(receivables, filename)
  }

  return (
    <div className="pb-20">
      {/* Долги по организациям */}
      {Object.keys(receivablesByOrganization).length > 0 && (
        <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Долги по организациям</h2>
            <button
              onClick={handleExportReceivables}
              className="bg-brand-light hover:bg-brand-dark text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1"
              title="Экспорт дебиторки в Excel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Экспорт
            </button>
          </div>
          <div className="space-y-4">
            {Object.values(receivablesByOrganization).map((orgData: any) => {
              const orgId = orgData.organization_id || 'unknown'
              const isExpanded = expandedOrganizations.has(orgId)
              const displayedCount = displayedOrdersCount[orgId] || 10
              const ordersToShow = orgData.receivables.slice(0, displayedCount)
              const hasMore = orgData.receivables.length > displayedCount

              return (
                <div key={orgId} className="border border-gray-200 rounded-lg p-4 bg-red-100/40">
                  <div 
                    className="flex justify-between items-start mb-3 cursor-pointer"
                    onClick={() => toggleOrganization(orgId)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-lg">{orgData.organization_name}</p>
                        <svg 
                          className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <p className="text-gray-600 text-sm mt-1">
                        {orgData.receivables.length} {orgData.receivables.length === 1 ? 'неоплаченный заказ' : 'неоплаченных заказов'}
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-red-400">
                      {orgData.total.toFixed(2)} BYN
                    </p>
                  </div>
                  {isExpanded && (
                    <div className="space-y-2 mt-3">
                      {ordersToShow.map((r: any) => (
                        <div 
                          key={r.id} 
                          className="bg-red-100/40 rounded p-3 cursor-pointer hover:bg-red-100/60 transition border border-gray-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (r.order_id) {
                              router.push(`/dashboard/client/orders/${r.order_id}`)
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
                                  {formatAddressForOrder(r.pickup_address)} → {formatAddressForOrder(r.delivery_address)}
                                </p>
                              )}
                              {r.driver_full_name && (
                                <p className="text-gray-600 text-xs mt-1">
                                  Водитель: {r.driver_full_name}
                                </p>
                              )}
                              <p className="text-gray-500 text-xs mt-1">
                                {new Date(r.created_at).toLocaleDateString('ru-RU', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <p className="text-red-400 font-semibold">
                              {parseFloat(r.amount || 0).toFixed(2)} BYN
                            </p>
                          </div>
                        </div>
                      ))}
                      {hasMore && (
                        <div className="mt-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              loadMoreOrders(orgId, displayedCount, orgData.receivables.length)
                            }}
                            className="bg-brand-light hover:bg-brand-dark text-gray-900 px-4 py-2 rounded-md text-sm transition"
                          >
                            Загрузить еще
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Фильтр по периоду для транзакций */}
      <div className="bg-gray-50 rounded-lg shadow p-4 mb-6">
        <h3 className="text-sm text-gray-600 mb-3">Фильтр по периоду для транзакций</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPeriod('today')}
            className={`px-4 py-2 rounded text-sm transition ${
              period === 'today' ? 'bg-brand-light text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Сегодня
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded text-sm transition ${
              period === 'week' ? 'bg-brand-light text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Неделя
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded text-sm transition ${
              period === 'month' ? 'bg-brand-light text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Месяц
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-4 py-2 rounded text-sm transition ${
              period === 'all' ? 'bg-brand-light text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setPeriod('custom')}
            className={`px-4 py-2 rounded text-sm transition ${
              period === 'custom' ? 'bg-brand-light text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Период
          </button>
        </div>
        {period === 'custom' && (
          <div className="mt-4 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">От</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">До</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* Все транзакции */}
      <div className="bg-gray-50 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Все транзакции</h2>
        {transactions.length > 0 ? (
          <>
            <div className="space-y-4">
              {transactions.slice(0, displayedTransactionsCount).map((transaction: any) => (
                <div 
                  key={transaction.id} 
                  className={`border border-gray-200 rounded-lg p-4 ${
                    transaction.type === 'credit' 
                      ? 'bg-green-100/40' 
                      : 'bg-red-100/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          transaction.type === 'credit' 
                            ? 'bg-green-200/50 text-green-700' 
                            : 'bg-red-200/50 text-red-700'
                        }`}>
                          {transaction.type === 'credit' ? 'Начисление' : 'Списание'}
                        </span>
                        {transaction.order && (
                          <span className="text-gray-600 text-xs">
                            Заказ {transaction.order.order_number ? `№${transaction.order.order_number}` : 'без номера'}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-900 font-medium text-sm mt-1">
                        {transaction.description}
                      </p>
                      {transaction.order && transaction.type === 'credit' && transaction.user_id !== userId && (
                        <p className="text-gray-600 text-xs mt-1">
                          Оплата водителем
                        </p>
                      )}
                      <p className="text-gray-500 text-xs mt-1">
                        {new Date(transaction.created_at).toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="ml-4">
                      <p className={`text-xl font-bold ${
                        transaction.type === 'credit' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {transaction.type === 'credit' ? '+' : '-'}{parseFloat(transaction.amount || 0).toFixed(2)} BYN
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {transactions.length > displayedTransactionsCount && (
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
          <div className="text-center py-8">
            <p className="text-gray-600">Нет транзакций за выбранный период</p>
          </div>
        )}
      </div>

    </div>
  )
}

