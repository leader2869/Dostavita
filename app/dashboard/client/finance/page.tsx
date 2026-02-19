'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { exportFinanceReportToExcel, exportOrdersToExcel, exportReceivablesToExcel } from '@/lib/utils/exportToExcel'

type Period = 'today' | 'week' | 'month' | 'all' | 'custom'

export default function ClientFinancePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [receivables, setReceivables] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  const getDateFilter = useCallback((period: Period) => {
    const now = new Date()
    switch (period) {
      case 'today':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
          end: now.toISOString()
        }
      case 'week':
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return {
          start: weekAgo.toISOString(),
          end: now.toISOString()
        }
      case 'month':
        const monthAgo = new Date(now)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        return {
          start: monthAgo.toISOString(),
          end: now.toISOString()
        }
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate).toISOString() : null,
          end: customEndDate ? new Date(customEndDate + 'T23:59:59').toISOString() : null
        }
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

      // Получаем выполненные заказы клиента
      let ordersQuery = supabase
        .from('orders')
        .select(`
          *,
          executor:profiles!orders_executor_user_id_fkey(id, full_name, organization_id),
          customer:profiles!orders_customer_id_fkey(full_name)
        `)
        .or(`customer_id.eq.${currentUser.id},client_id.eq.${currentUser.id}`)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (dateFilter.start) {
        ordersQuery = ordersQuery.gte('completed_at', dateFilter.start)
      }
      if (dateFilter.end) {
        ordersQuery = ordersQuery.lte('completed_at', dateFilter.end)
      }

      const { data: ordersData, error: ordersError } = await ordersQuery

      if (ordersError) {
        console.error('Ошибка загрузки заказов:', ordersError)
      } else {
        setCompletedOrders(ordersData || [])
      }

      // Получаем дебиторку клиента
      const { data: receivablesData, error: receivablesError } = await supabase
        .rpc('get_client_receivables', {
          client_user_id: currentUser.id,
          start_date: dateFilter.start,
          end_date: dateFilter.end
        })

      if (receivablesError) {
        console.error('Ошибка загрузки дебиторки:', receivablesError)
        setReceivables([])
      } else {
        setReceivables(receivablesData || [])
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
      setLoading(false)
    }
  }, [supabase, router, period, customStartDate, customEndDate, getDateFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

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
  const totalCompletedAmount = completedOrders.reduce((sum, o) => sum + (parseFloat(o.final_price) || 0), 0)
  const totalPaidAmount = completedOrders
    .filter((o: any) => o.is_paid === true)
    .reduce((sum, o) => sum + (parseFloat(o.final_price) || 0), 0)

  if (loading) {
    return (
      <div className="pb-20">
        <BackButton />
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }

  const handleExportAll = () => {
    const dateFilter = getDateFilter(period as Period)
    const filename = `Финансовый_отчет_${period}_${new Date().toISOString().split('T')[0]}`
    
    exportFinanceReportToExcel({
      orders: completedOrders,
      receivables: receivables,
      summary: {
        'Выполненных заказов': completedOrders.length,
        'Общая сумма заказов': totalCompletedAmount.toFixed(2) + ' BYN',
        'Оплаченная сумма': totalPaidAmount.toFixed(2) + ' BYN',
        'Общая дебиторка': totalReceivables.toFixed(2) + ' BYN',
        'Период': period === 'all' ? 'Все время' : period === 'today' ? 'Сегодня' : period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Выбранный период',
      }
    }, filename)
  }

  const handleExportOrders = () => {
    const filename = `Заказы_${period}_${new Date().toISOString().split('T')[0]}`
    exportOrdersToExcel(completedOrders, filename)
  }

  const handleExportReceivables = () => {
    const filename = `Дебиторка_${new Date().toISOString().split('T')[0]}`
    exportReceivablesToExcel(receivables, filename)
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

      {/* Общая статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Выполненных заказов</h3>
          <p className="text-3xl font-bold text-brand-light">{completedOrders.length}</p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Общая сумма заказов</h3>
          <p className="text-3xl font-bold text-blue-400">{totalCompletedAmount.toFixed(2)} BYN</p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Долги</h3>
          <p className="text-3xl font-bold text-red-400">{totalReceivables.toFixed(2)} BYN</p>
        </div>
      </div>

      {/* Фильтр по периоду */}
      <div className="bg-gray-50 rounded-lg shadow p-4 mb-6">
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
            {Object.values(receivablesByOrganization).map((orgData: any) => (
              <div key={orgData.organization_id || 'unknown'} className="border border-red-500/50 rounded-lg p-4 bg-gray-100/50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">{orgData.organization_name}</p>
                    <p className="text-gray-600 text-sm mt-1">
                      {orgData.receivables.length} {orgData.receivables.length === 1 ? 'неоплаченный заказ' : 'неоплаченных заказов'}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-red-400">
                    {orgData.total.toFixed(2)} BYN
                  </p>
                </div>
                <div className="space-y-2 mt-3">
                  {orgData.receivables.map((r: any) => (
                    <div 
                      key={r.id} 
                      className="bg-gray-600/50 rounded p-3 cursor-pointer hover:bg-gray-100 transition"
                      onClick={() => {
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Выполненные заказы */}
      <div className="bg-gray-50 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Выполненные заказы</h2>
        {completedOrders.length > 0 ? (
          <div className="space-y-4">
            {completedOrders.map((order: any) => (
              <div 
                key={order.id} 
                className="border border-gray-200 rounded-lg p-4 bg-gray-100/50 cursor-pointer hover:bg-gray-100 transition"
                onClick={() => router.push(`/dashboard/client/orders/${order.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold text-gray-900 text-lg">
                        Заказ {order.order_number ? `№${order.order_number}` : 'без номера'}
                      </p>
                      <span className={`px-2 py-1 text-xs rounded ${
                        order.is_paid ? 'bg-brand-light/20 text-brand-light' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {order.is_paid ? 'Оплачен' : 'Не оплачен'}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-gray-700">
                        Сумма: <span className="text-gray-900 font-semibold">{parseFloat(order.final_price || 0).toFixed(2)} BYN</span>
                      </p>
                      {order.pickup_address && order.delivery_address && (
                        <p className="text-gray-600 text-xs">
                          {formatAddressForOrder(order.pickup_address)} → {formatAddressForOrder(order.delivery_address)}
                        </p>
                      )}
                      {order.executor && order.executor.full_name && (
                        <p className="text-gray-700">
                          Организация: <span className="text-gray-900">{order.executor.full_name}</span>
                        </p>
                      )}
                      {order.completed_at && (
                        <p className="text-gray-600 text-xs mt-1">
                          Завершен: {new Date(order.completed_at).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-xl font-bold text-brand-light">
                      {parseFloat(order.final_price || 0).toFixed(2)} BYN
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">Нет выполненных заказов за выбранный период</p>
          </div>
        )}
      </div>

    </div>
  )
}

