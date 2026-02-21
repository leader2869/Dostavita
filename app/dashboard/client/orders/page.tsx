'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClientOrderActions } from '@/components/client/ClientOrderActions'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'
import { exportOrdersToExcel } from '@/lib/utils/exportToExcel'

type Period = 'today' | 'week' | 'month' | 'all' | 'custom'

export default function ClientOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [completedFilter, setCompletedFilter] = useState<'all' | 'unpaid' | 'cancelled'>('all')
  const [displayedCompletedOrdersCount, setDisplayedCompletedOrdersCount] = useState(10)
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [receivables, setReceivables] = useState<any[]>([])
  const [period, setPeriod] = useState<Period>('week')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [isActiveOrdersExpanded, setIsActiveOrdersExpanded] = useState(false)

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
    let isMounted = true
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        if (isMounted) {
          router.push('/login')
        }
        return
      }

      if (isMounted) {
        setCurrentUserId(user.id)
      }

      // Получаем все заказы с информацией о профилях для поиска
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:profiles!orders_customer_id_fkey(id, full_name, phone),
          client:profiles!orders_client_id_fkey(id, full_name, phone),
          executor:profiles!orders_executor_user_id_fkey(id, full_name, organization_id)
        `)
        .or(`customer_id.eq.${user.id},client_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (!isMounted) return

      if (error) {
        console.error('Ошибка загрузки заказов:', error)
      } else {
        setOrders(ordersData || [])
      }

      // Загружаем выполненные заказы с фильтром по периоду
      const dateFilter = getDateFilter(period as Period)
      let completedOrdersQuery = supabase
        .from('orders')
        .select(`
          *,
          executor:profiles!orders_executor_user_id_fkey(id, full_name, organization_id),
          customer:profiles!orders_customer_id_fkey(full_name)
        `)
        .or(`customer_id.eq.${user.id},client_id.eq.${user.id}`)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (dateFilter.start) {
        completedOrdersQuery = completedOrdersQuery.gte('completed_at', dateFilter.start)
      }
      if (dateFilter.end) {
        completedOrdersQuery = completedOrdersQuery.lte('completed_at', dateFilter.end)
      }

      const { data: completedOrdersData, error: completedOrdersError } = await completedOrdersQuery

      if (!isMounted) return

      if (completedOrdersError) {
        console.error('Ошибка загрузки выполненных заказов:', completedOrdersError)
      } else {
        setCompletedOrders(completedOrdersData || [])
      }

      // Загружаем долги (всегда за все время)
      const { data: receivablesData, error: receivablesError } = await supabase
        .rpc('get_client_receivables', {
          client_user_id: user.id,
          start_date: null,
          end_date: null
        })

      if (!isMounted) return

      if (receivablesError) {
        console.error('Ошибка загрузки дебиторки:', receivablesError)
        setReceivables([])
      } else {
        setReceivables(receivablesData || [])
      }
      
      if (isMounted) {
        setLoading(false)
      }
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
      if (isMounted) {
        setLoading(false)
      }
    }
    
    return () => {
      isMounted = false
    }
  }, [supabase, router, period, customStartDate, customEndDate, getDateFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Сбрасываем счетчик при смене периода или фильтров
  useEffect(() => {
    setDisplayedCompletedOrdersCount(10)
  }, [period, customStartDate, customEndDate, completedFilter, searchQuery])

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'searching_courier':
        return 'Ищем курьера'
      case 'courier_accepted':
        return 'Курьер принял заказ'
      case 'courier_coming':
        return 'Курьер едет к отправителю'
      case 'courier_delivering':
        return 'Курьер едет к получателю'
      case 'completed':
        return 'Заказ завершен'
      case 'cancelled':
        return 'Отменен'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'searching_courier':
        return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50'
      case 'courier_accepted':
        return 'text-orange-400 bg-orange-400/20 border-orange-400/50'
      case 'courier_coming':
        return 'text-blue-400 bg-blue-400/20 border-blue-400/50'
      case 'courier_delivering':
        return 'text-purple-400 bg-purple-400/20 border-purple-400/50'
      case 'completed':
        return 'text-brand-light bg-brand-light/20 border-green-400/50'
      case 'cancelled':
        return 'text-red-400 bg-red-400/20 border-red-400/50'
      default:
        return 'text-gray-600 bg-gray-400/20 border-gray-400/50'
    }
  }

  const shouldBlink = (status: string) => {
    // Мигают только активные статусы
    return status === 'searching_courier' || status === 'courier_accepted' || status === 'courier_coming' || status === 'courier_delivering'
  }

  // Функция фильтрации заказов по поисковому запросу (только по номеру заказа)
  const filterOrdersBySearch = (orderList: any[]) => {
    if (!searchQuery || !searchQuery.trim()) return orderList

    // Нормализуем запрос: убираем пробелы
    const query = searchQuery.trim()
    
    return orderList.filter((order: any) => {
      // Проверяем номер заказа
      if (order.order_number != null && order.order_number !== undefined) {
        // Приводим к строке и сравниваем точное совпадение
        const orderNumberStr = String(order.order_number).trim()
        if (orderNumberStr === query) {
          return true
        }
      }
      
      // Если номер заказа отсутствует, проверяем первые 8 символов ID
      if (order.id) {
        const orderIdPrefix = String(order.id).slice(0, 8).trim()
        if (orderIdPrefix === query) {
          return true
        }
      }
      
      return false
    })
  }

  // Разделяем заказы на активные и завершенные
  const allActiveOrders = orders.filter(order => 
    order.status !== 'completed' && order.status !== 'cancelled'
  )
  const allCompletedOrders = orders.filter(order => 
    order.status === 'completed' || order.status === 'cancelled'
  )

  // Фильтруем завершенные заказы по выбранному фильтру
  const filteredCompletedOrders = allCompletedOrders.filter((order: any) => {
    if (completedFilter === 'unpaid') {
      return order.status === 'completed' && (order.is_paid === false || order.is_paid === null)
    }
    if (completedFilter === 'cancelled') {
      return order.status === 'cancelled'
    }
    return true // 'all' - показываем все завершенные
  })

  // Применяем фильтр поиска
  const activeOrders = filterOrdersBySearch(allActiveOrders)
  const completedOrdersFromAll = filterOrdersBySearch(filteredCompletedOrders)
  
  // Отладочное логирование (можно удалить после проверки)
  useEffect(() => {
    if (searchQuery.trim() && orders.length > 0) {
      console.log('=== ОТЛАДКА ПОИСКА ===')
      console.log('Поисковый запрос:', searchQuery)
      console.log('Всего заказов:', orders.length)
      console.log('Активных заказов (до фильтра):', allActiveOrders.length)
      console.log('Завершенных заказов (до фильтра):', filteredCompletedOrders.length)
      console.log('Пример активного заказа:', allActiveOrders[0] ? {
        id: allActiveOrders[0]?.id,
        order_number: allActiveOrders[0]?.order_number,
        order_number_type: typeof allActiveOrders[0]?.order_number,
        order_number_string: String(allActiveOrders[0]?.order_number || ''),
        status: allActiveOrders[0]?.status
      } : 'нет активных заказов')
      console.log('Пример завершенного заказа:', filteredCompletedOrders[0] ? {
        id: filteredCompletedOrders[0]?.id,
        order_number: filteredCompletedOrders[0]?.order_number,
        order_number_type: typeof filteredCompletedOrders[0]?.order_number,
        order_number_string: String(filteredCompletedOrders[0]?.order_number || ''),
        status: filteredCompletedOrders[0]?.status
      } : 'нет завершенных заказов')
      console.log('Отфильтровано активных:', activeOrders.length)
      console.log('Отфильтровано завершенных:', completedOrdersFromAll.length)
      if (activeOrders.length > 0) {
        console.log('Найденные активные заказы:', activeOrders.map((o: any) => ({ id: o.id, order_number: o.order_number })))
      }
      if (completedOrdersFromAll.length > 0) {
        console.log('Найденные завершенные заказы:', completedOrdersFromAll.map((o: any) => ({ id: o.id, order_number: o.order_number })))
      }
    }
  }, [searchQuery, orders.length, allActiveOrders.length, filteredCompletedOrders.length, activeOrders.length, completedOrdersFromAll.length])

  // Вычисляем статистику
  const totalReceivables = receivables.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
  const totalCompletedAmount = completedOrders.reduce((sum, o) => sum + (parseFloat(o.final_price) || 0), 0)

  // Сбрасываем счетчик при смене фильтра или поиска
  useEffect(() => {
    setDisplayedCompletedOrdersCount(10)
  }, [completedFilter, searchQuery])

  const renderOrderCard = (order: any) => {
    // Проверяем, можно ли редактировать заказ
    const canEdit = order.status === 'searching_courier' && !order.executor_user_id
    // Легкая зеленая заливка для завершенных оплаченных заказов
    const isCompletedAndPaid = order.status === 'completed' && order.is_paid === true
    // Легкая желтая заливка для неоплаченных заказов
    const isUnpaid = order.status === 'completed' && (order.is_paid === false || order.is_paid === null)
    // Легкая красная заливка для отмененных заказов
    const isCancelled = order.status === 'cancelled'
    
    return (
      <div
        key={order.id}
        className={`rounded-lg shadow p-6 border border-gray-200 hover:border-green-500 transition cursor-pointer relative ${
          isCancelled
            ? 'bg-red-100/40'
            : isCompletedAndPaid 
            ? 'bg-green-100/40' 
            : isUnpaid 
            ? 'bg-yellow-100/40' 
            : 'bg-gray-50'
        }`}
        onClick={() => router.push(`/dashboard/client/orders/${order.id}`)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="font-medium text-gray-900">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
            <p className="text-sm text-gray-700 mt-1">
              а) {formatAddressForOrder(order.pickup_address)}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              б) {formatAddressForOrder(order.delivery_address)}
            </p>
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                  getStatusColor(order.status)
                } ${shouldBlink(order.status) ? 'animate-blink' : ''}`}
              >
                {getStatusLabel(order.status)}
              </span>
              {isUnpaid && (
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold border bg-yellow-200/50 text-yellow-700 border-yellow-300/50">
                  Не оплачен
                </span>
              )}
            </div>
            {order.item_type && (
              <p className="text-sm text-gray-600 mt-1">
                Тип груза: <span className="text-gray-700">
                  {order.item_type === 'documents' ? 'Документы' :
                   order.item_type === 'parcel' ? 'Посылка' :
                   order.item_type === 'flowers' ? 'Цветы' :
                   order.item_type === 'food' ? 'Еда' :
                   order.item_type === 'other' ? 'Другое' : 'Не указан'}
                </span>
              </p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              Создан: <span className="text-gray-700">
                {new Date(order.created_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </p>
            {order.description && (
              <p className="text-sm text-gray-600 mt-1 italic">
                {order.description}
              </p>
            )}
          </div>
          <div className="text-right ml-4">
            <p className="font-semibold text-lg text-gray-900">{order.final_price} BYN</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/dashboard/client/orders/${order.id}/edit`)
              }}
              className="flex-1 bg-brand-light text-gray-900 px-3 py-1.5 rounded text-xs hover:bg-brand-dark transition"
            >
              Редактировать
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation()
                if (!confirm('Вы уверены, что хотите отменить этот заказ?')) {
                  return
                }
                try {
                  const response = await fetch(`/api/orders/${order.id}/cancel`, {
                    method: 'POST',
                  })
                  const data = await response.json()
                  if (response.ok) {
                    alert('Заказ успешно отменен')
                    window.location.reload()
                  } else {
                    alert(data.error || 'Не удалось отменить заказ')
                  }
                } catch (error) {
                  console.error('Ошибка отмены заказа:', error)
                  alert('Произошла ошибка при отмене заказа')
                }
              }}
              className="flex-1 bg-red-300 text-gray-900 px-3 py-1.5 rounded text-xs hover:bg-red-400 transition"
            >
              Отменить заказ
            </button>
          </div>
        )}
        {/* Кнопки телефона, сообщения и поделиться для активных заказов */}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <ClientOrderActions order={order} userId={currentUserId || ''} />
        )}
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
        {/* Поиск по заказам */}
        <div className="flex-1 min-w-[200px] max-w-md">
          <input
            type="text"
            placeholder="Поиск по номеру заказа..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-light"
          />
        </div>
        <button
          onClick={() => {
            const filename = `Мои_заказы_${new Date().toISOString().split('T')[0]}`
            exportOrdersToExcel(orders, filename)
          }}
          className="bg-brand-light hover:bg-brand-dark text-white px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2"
          title="Экспорт заказов в Excel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Экспорт в Excel
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Выполненных заказов</h3>
          <p className="text-3xl font-bold text-brand-light">{completedOrders.length}</p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Общая сумма заказов</h3>
          <p className="text-3xl font-bold text-green-600">{totalCompletedAmount.toFixed(2)} BYN</p>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Долги</h3>
          <p className="text-3xl font-bold text-red-400">{totalReceivables.toFixed(2)} BYN</p>
        </div>
      </div>

      {/* Фильтр по периоду */}
      <div className="bg-gray-50 rounded-lg shadow p-4 mb-6">
        <h3 className="text-sm text-gray-600 mb-3">Фильтр по периоду для выполненных заказов</h3>
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

      {loading ? (
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <p className="text-gray-600">Загрузка...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Активные заказы */}
          {activeOrders.length > 0 && (
            <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => setIsActiveOrdersExpanded(!isActiveOrdersExpanded)}
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Активные заказы ({activeOrders.length})
                  </h2>
                  <svg 
                    className={`w-5 h-5 text-gray-600 transition-transform ${isActiveOrdersExpanded ? 'transform rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {isActiveOrdersExpanded && (
                <div className="space-y-4">
                  {activeOrders.map((order: any) => (
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
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                            getStatusColor(order.status)
                          } ${shouldBlink(order.status) ? 'animate-blink' : ''}`}>
                            {getStatusLabel(order.status)}
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
                          <p className="text-gray-600 text-xs mt-1">
                            Создан: {new Date(order.created_at).toLocaleDateString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        {/* Кнопки действий для активных заказов */}
                        {order.status === 'searching_courier' && !order.executor_user_id && (
                          <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/dashboard/client/orders/${order.id}/edit`)
                              }}
                              className="flex-1 bg-brand-light text-gray-900 px-3 py-1.5 rounded text-xs hover:bg-brand-dark transition"
                            >
                              Редактировать
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!confirm('Вы уверены, что хотите отменить этот заказ?')) {
                                  return
                                }
                                try {
                                  const response = await fetch(`/api/orders/${order.id}/cancel`, {
                                    method: 'POST',
                                  })
                                  const data = await response.json()
                                  if (response.ok) {
                                    alert('Заказ успешно отменен')
                                    window.location.reload()
                                  } else {
                                    alert(data.error || 'Не удалось отменить заказ')
                                  }
                                } catch (error) {
                                  console.error('Ошибка отмены заказа:', error)
                                  alert('Произошла ошибка при отмене заказа')
                                }
                              }}
                              className="flex-1 bg-red-300 text-gray-900 px-3 py-1.5 rounded text-xs hover:bg-red-400 transition"
                            >
                              Отменить заказ
                            </button>
                          </div>
                        )}
                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <ClientOrderActions order={order} userId={currentUserId || ''} />
                          </div>
                        )}
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
              )}
            </div>
          )}

          {/* Выполненные заказы */}
          <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Выполненные заказы</h2>
              {completedOrdersFromAll.length > 0 && (
                <button
                  onClick={() => {
                    const filename = `Выполненные_заказы_${period}_${new Date().toISOString().split('T')[0]}`
                    exportOrdersToExcel(completedOrdersFromAll, filename)
                  }}
                  className="bg-brand-light hover:bg-brand-dark text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1"
                  title="Экспорт выполненных заказов в Excel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Экспорт
                </button>
              )}
            </div>
            {completedOrdersFromAll.length > 0 ? (
              <div className="space-y-4">
                {completedOrdersFromAll.slice(0, displayedCompletedOrdersCount).map((order: any) => (
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
                            order.is_paid ? 'bg-green-100/40 text-green-700' : 'bg-red-100/40 text-red-700'
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
                {completedOrdersFromAll.length > displayedCompletedOrdersCount && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setDisplayedCompletedOrdersCount(prev => prev + 10)}
                      className="bg-brand-light hover:bg-brand-dark text-gray-900 px-6 py-2 rounded-md transition"
                    >
                      Загрузить еще
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">Сегодня еще не было заказов</p>
              </div>
            )}
          </div>

          {/* Если нет заказов вообще */}
          {orders.length === 0 && (
            <div className="bg-gray-50 rounded-lg shadow p-6">
              <p className="text-gray-600">У вас пока нет заказов</p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

