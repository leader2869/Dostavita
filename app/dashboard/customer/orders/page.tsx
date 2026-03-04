'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'
import { getOrderStatusLabel, getOrderStatusColor } from '@/lib/utils/orderStatus'
import { exportOrdersToExcel } from '@/lib/utils/exportToExcel'
import { useDateFilter } from '@/hooks/useDateFilter'
import { toastError } from '@/lib/utils/toast'
import { useDashboardUser } from '@/contexts/DashboardAuthContext'

export default function CustomerOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const { userId, profile } = useDashboardUser()
  const { period, setPeriod, getDateFilter } = useDateFilter('week')

  const [loading, setLoading] = useState(true)
  const [availableOrders, setAvailableOrders] = useState<any[]>([])
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [completedOrders, setCompletedOrders] = useState<any[]>([])
  const [driverIds, setDriverIds] = useState<string[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [assigningDriver, setAssigningDriver] = useState<string | null>(null)
  const [selectedDriverForOrder, setSelectedDriverForOrder] = useState<{ [orderId: string]: string }>({})
  const [displayedCompletedOrdersCount, setDisplayedCompletedOrdersCount] = useState(10)
  const [completedFilter, setCompletedFilter] = useState<'all' | 'unpaid' | 'cancelled'>('all')
  const [showActiveOrders, setShowActiveOrders] = useState(false)
  const [showCompletedOrders, setShowCompletedOrders] = useState(true)

  const loadData = useCallback(async () => {
    try {
      if (profile.role !== 'customer') {
        router.push('/dashboard')
        return
      }

      // Получаем водителей организации
      const { data: driversData } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('organization_id', userId)
        .eq('role', 'driver')

      const ids = driversData?.map((d: any) => d.id) || []
      setDriverIds(ids)
      setDrivers(driversData || [])

      // Получаем доступные заказы (searching_courier) - заказы организации, которые еще не приняты
      const { data: available } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', userId)
        .eq('status', 'searching_courier')
        .order('created_at', { ascending: false })

      setAvailableOrders(available || [])

      // Получаем все активные заказы всех водителей организации
      let active: any[] = []
      
      if (ids.length > 0) {
        // Заказы всех водителей организации в активных статусах
        const { data: driverActiveOrders } = await supabase
          .from('orders')
          .select(`
            *,
            executor:profiles!orders_executor_user_id_fkey(id, full_name, phone),
            client:profiles!orders_client_id_fkey(id, full_name, phone),
            customer:profiles!orders_customer_id_fkey(id, full_name, phone)
          `)
          .in('executor_user_id', ids)
          .in('status', ['courier_accepted', 'courier_coming', 'courier_delivering'])
          .order('created_at', { ascending: false })
        
        active = (driverActiveOrders || []).map((order: any) => ({
          ...order,
          driver_full_name: order.executor?.full_name,
          driver_phone: order.executor?.phone
        }))
      }
      
      setActiveOrders(active)

      // Получаем завершенные заказы с фильтром по периоду
      const dateFilter = getDateFilter()
      
      // Получаем все завершенные заказы всех водителей организации
      let completed: any[] = []
      
      if (ids.length > 0) {
        // Сначала загружаем все завершенные и отмененные заказы без фильтра по дате
        let driverCompletedQuery = supabase
          .from('orders')
          .select(`
            *,
            executor:profiles!orders_executor_user_id_fkey(id, full_name, phone),
            client:profiles!orders_client_id_fkey(id, full_name, phone),
            customer:profiles!orders_customer_id_fkey(id, full_name, phone)
          `)
          .in('executor_user_id', ids)
          .in('status', ['completed', 'cancelled'])

        const { data: driverCompleted, error: completedError } = await driverCompletedQuery
        
        if (completedError) {
          console.error('Ошибка загрузки завершенных заказов:', completedError)
        }
        
        // Фильтруем на клиенте по дате
        let filteredCompleted = (driverCompleted || []).filter((order: any) => {
          // Если фильтр не задан, показываем все
          if (!dateFilter.start && !dateFilter.end) {
            return true
          }
          
          let orderDate: Date | null = null
          
          if (order.status === 'completed' && order.completed_at) {
            orderDate = new Date(order.completed_at)
          } else if (order.status === 'cancelled') {
            // Для отмененных используем cancelled_at или created_at
            orderDate = order.cancelled_at ? new Date(order.cancelled_at) : new Date(order.created_at)
          } else {
            // Для других статусов используем created_at
            orderDate = new Date(order.created_at)
          }
          
          if (!orderDate) return true
          
          const filterStart = dateFilter.start ? new Date(dateFilter.start) : null
          const filterEnd = dateFilter.end ? new Date(dateFilter.end) : null
          
          // Проверяем фильтр по дате
          if (filterStart && orderDate < filterStart) return false
          if (filterEnd && orderDate > filterEnd) return false
          
          return true
        })
        
        completed = filteredCompleted.map((order: any) => ({
          ...order,
          driver_full_name: order.executor?.full_name,
          driver_phone: order.executor?.phone
        }))
      }
      
      // Сортируем по дате завершения
      completed.sort((a: any, b: any) => {
        const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return dateB - dateA
      })
      
      const completedWithDriver = completed.map((order: any) => ({
        ...order,
        driver_full_name: order.executor?.full_name,
        driver_phone: order.executor?.phone
      }))
      
      setCompletedOrders(completedWithDriver)
      setDisplayedCompletedOrdersCount(10) // Сбрасываем счетчик при загрузке
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, userId, profile.role, period, getDateFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Фильтруем завершенные заказы
  const filteredCompletedOrders = completedOrders.filter((order: any) => {
    if (completedFilter === 'unpaid') {
      return order.status === 'completed' && !order.is_paid
    }
    if (completedFilter === 'cancelled') {
      return order.status === 'cancelled'
    }
    return true
  })

  const displayedCompletedOrders = filteredCompletedOrders.slice(0, displayedCompletedOrdersCount)
  const hasMoreCompleted = displayedCompletedOrdersCount < filteredCompletedOrders.length

  const handleExportCompleted = () => {
    exportOrdersToExcel(filteredCompletedOrders, 'Завершенные заказы', () =>
          toastError('Нет данных для экспорта')
        )
  }

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    if (!driverId) return

    setAssigningDriver(orderId)
    try {
      // Используем функцию accept_order для назначения водителя
      const { data, error } = await supabase.rpc('accept_order', {
        order_uuid: orderId,
        driver_user_uuid: driverId
      })

      if (error) {
        console.error('Ошибка назначения водителя:', error)
        toastError('Не удалось назначить водителя. Попробуйте еще раз.')
        return
      }

      if (data) {
        // Обновляем данные
        await loadData()
        // Очищаем выбранного водителя для этого заказа
        setSelectedDriverForOrder(prev => {
          const newState = { ...prev }
          delete newState[orderId]
          return newState
        })
      } else {
        toastError('Не удалось назначить водителя. Возможно, заказ уже был принят или водитель недоступен.')
      }
    } catch (err: any) {
      console.error('Ошибка назначения водителя:', err)
      toastError('Произошла ошибка при назначении водителя.')
    } finally {
      setAssigningDriver(null)
    }
  }

  if (loading) {
    return (
      <div className="pb-20">
        <p className="text-gray-600">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="space-y-6">
        {/* Доступные заказы */}
        {availableOrders && availableOrders.length > 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Доступные заказы ({availableOrders.length})
            </h2>
            <div className="space-y-4">
              {availableOrders.map((order: any) => (
                <div
                  key={order.id}
                  className="block border border-gray-200 rounded-lg p-4 bg-gray-100"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <a
                        href={`/dashboard/customer/orders/${order.id}`}
                        className="block"
                      >
                        <p className="font-medium text-gray-900">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                        <p className="text-sm text-gray-700 mt-1">
                          а) {formatAddressForOrder(order.pickup_address)}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          б) {formatAddressForOrder(order.delivery_address)}
                        </p>
                        <div className="mt-2">
                          <span className="text-sm text-gray-600">Статус: </span>
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                              getOrderStatusColor(order.status)
                            }`}
                          >
                            {getOrderStatusLabel(order.status)}
                          </span>
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
                        {order.ready_at && (() => {
                          const { formattedTime, timeStatus, statusType } = formatReadyTime(order.ready_at)
                          return (
                            <p className="text-sm text-gray-600 mt-1">
                              Заказ будет готов к выдаче: <span className="text-gray-700">{formattedTime}</span>
                              {timeStatus && (
                                <span className={`ml-2 ${statusType === 'waiting' ? 'text-red-400 animate-blink' : statusType === 'upcoming' ? 'text-yellow-400 animate-blink' : 'text-gray-600'}`}>
                                  ({timeStatus})
                                </span>
                              )}
                            </p>
                          )
                        })()}
                      </a>
                      
                      {/* Блок назначения водителя */}
                      <div className="mt-4 pt-4 border-t border-gray-300">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Назначить водителя:
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={selectedDriverForOrder[order.id] || ''}
                            onChange={(e) => setSelectedDriverForOrder(prev => ({
                              ...prev,
                              [order.id]: e.target.value
                            }))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-light"
                            disabled={assigningDriver === order.id}
                          >
                            <option value="">Выберите водителя</option>
                            {drivers.map((driver: any) => (
                              <option key={driver.id} value={driver.id}>
                                {driver.full_name} {driver.phone ? `(${driver.phone})` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAssignDriver(order.id, selectedDriverForOrder[order.id])}
                            disabled={!selectedDriverForOrder[order.id] || assigningDriver === order.id}
                            className="px-4 py-2 bg-brand-light text-gray-900 rounded-md hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            {assigningDriver === order.id ? 'Назначаем...' : 'Назначить'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-gray-900 text-lg">{order.final_price} BYN</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Активные заказы */}
        {activeOrders.length > 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <button
              onClick={() => setShowActiveOrders(!showActiveOrders)}
              className="w-full flex justify-between items-center mb-4 pb-2 border-b border-gray-200"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                Активные заказы ({activeOrders.length})
              </h2>
              <svg
                className={`w-5 h-5 text-gray-600 transition-transform ${showActiveOrders ? 'transform rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showActiveOrders && (
              <div className="space-y-4">
                {activeOrders.map((order: any) => (
                <a
                  key={order.id}
                  href={`/dashboard/customer/orders/${order.id}`}
                  className="block border border-gray-200 rounded-lg p-4 bg-gray-100 hover:bg-gray-100 transition cursor-pointer"
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
                      <div className="mt-2">
                        <span className="text-sm text-gray-600">Статус: </span>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                            getOrderStatusColor(order.status)
                          }`}
                        >
                          {getOrderStatusLabel(order.status)}
                        </span>
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
                      {order.ready_at && (() => {
                        const { formattedTime, timeStatus, statusType } = formatReadyTime(order.ready_at)
                        return (
                          <p className="text-sm text-gray-600 mt-1">
                            Заказ будет готов к выдаче: <span className="text-gray-700">{formattedTime}</span>
                            {timeStatus && (
                              <span className={`ml-2 ${statusType === 'waiting' ? 'text-red-400 animate-blink' : statusType === 'upcoming' ? 'text-yellow-400 animate-blink' : 'text-gray-600'}`}>
                                ({timeStatus})
                              </span>
                            )}
                          </p>
                        )
                      })()}
                      {order.driver_full_name && (
                        <p className="text-sm text-gray-600 mt-2">
                          Водитель: <span className="text-gray-700">{order.driver_full_name}</span>
                          {order.driver_phone && (
                            <span className="text-gray-600 ml-2">({order.driver_phone})</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-gray-900 text-lg">{order.final_price} BYN</p>
                    </div>
                  </div>
                </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Завершенные заказы */}
        {completedOrders.length > 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <button
              onClick={() => setShowCompletedOrders(!showCompletedOrders)}
              className="w-full flex justify-between items-center mb-4 pb-2 border-b border-gray-200"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                Завершенные заказы ({filteredCompletedOrders.length})
              </h2>
              <div className="flex items-center gap-2">
                {filteredCompletedOrders.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleExportCompleted()
                    }}
                    className="bg-brand-light text-gray-900 px-4 py-2 rounded-md hover:bg-brand-dark transition text-sm"
                  >
                    Экспорт
                  </button>
                )}
                <svg
                  className={`w-5 h-5 text-gray-600 transition-transform ${showCompletedOrders ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {showCompletedOrders && (
              <>
            {/* Фильтр по периоду */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => {
                  setPeriod('today')
                  setDisplayedCompletedOrdersCount(10)
                }}
                className={`px-3 py-1 rounded text-sm transition ${
                  period === 'today'
                    ? 'bg-brand-light text-gray-900'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Сегодня
              </button>
              <button
                onClick={() => {
                  setPeriod('week')
                  setDisplayedCompletedOrdersCount(10)
                }}
                className={`px-3 py-1 rounded text-sm transition ${
                  period === 'week'
                    ? 'bg-brand-light text-gray-900'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Неделя
              </button>
              <button
                onClick={() => {
                  setPeriod('month')
                  setDisplayedCompletedOrdersCount(10)
                }}
                className={`px-3 py-1 rounded text-sm transition ${
                  period === 'month'
                    ? 'bg-brand-light text-gray-900'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Месяц
              </button>
              <button
                onClick={() => {
                  setPeriod('all')
                  setDisplayedCompletedOrdersCount(10)
                }}
                className={`px-3 py-1 rounded text-sm transition ${
                  period === 'all'
                    ? 'bg-brand-light text-gray-900'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Все
              </button>
            </div>

            {/* Фильтры по статусу */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setCompletedFilter('all')}
                className={`px-3 py-1 rounded text-sm transition ${
                  completedFilter === 'all'
                    ? 'bg-brand-light text-gray-900'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setCompletedFilter('unpaid')}
                className={`px-3 py-1 rounded text-sm transition ${
                  completedFilter === 'unpaid'
                    ? 'bg-brand-light text-gray-900'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Неоплаченные
              </button>
              <button
                onClick={() => setCompletedFilter('cancelled')}
                className={`px-3 py-1 rounded text-sm transition ${
                  completedFilter === 'cancelled'
                    ? 'bg-brand-light text-gray-900'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Отмененные
              </button>
            </div>

            {displayedCompletedOrders.length > 0 ? (
              <>
                <div className="space-y-4">
                  {displayedCompletedOrders.map((order: any) => {
                    const isUnpaid = order.status === 'completed' && !order.is_paid
                    const isCancelled = order.status === 'cancelled'
                    
                    return (
                      <Link
                        key={order.id}
                        href={`/dashboard/customer/orders/${order.id}`}
                        className={`block border border-gray-200 rounded-lg p-4 transition cursor-pointer ${
                          isUnpaid
                            ? 'bg-yellow-100/40 hover:bg-yellow-100/60'
                            : isCancelled
                            ? 'bg-red-100/40 hover:bg-red-100/60'
                            : 'bg-green-100/40 hover:bg-green-100/60'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-gray-900">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                              {isUnpaid && (
                                <span className="px-2 py-0.5 bg-yellow-200/50 text-gray-900 text-xs rounded">
                                  Не оплачен
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 mt-1">
                              а) {formatAddressForOrder(order.pickup_address)}
                            </p>
                            <p className="text-sm text-gray-700 mt-1">
                              б) {formatAddressForOrder(order.delivery_address)}
                            </p>
                            <div className="mt-2">
                              <span className="text-sm text-gray-600">Статус: </span>
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                                  getOrderStatusColor(order.status)
                                }`}
                              >
                                {getOrderStatusLabel(order.status)}
                              </span>
                            </div>
                            {order.driver_full_name && (
                              <p className="text-sm text-gray-600 mt-2">
                                Водитель: <span className="text-gray-700">{order.driver_full_name}</span>
                                {order.driver_phone && (
                                  <span className="text-gray-600 ml-2">({order.driver_phone})</span>
                                )}
                              </p>
                            )}
                            {order.completed_at && (
                              <p className="text-sm text-gray-600 mt-1">
                                Завершен: {new Date(order.completed_at).toLocaleString('ru-RU')}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-semibold text-gray-900 text-lg">{order.final_price} BYN</p>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
                {hasMoreCompleted && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setDisplayedCompletedOrdersCount(prev => prev + 10)}
                      className="bg-brand-light text-gray-900 px-6 py-2 rounded-md hover:bg-brand-dark transition"
                    >
                      Загрузить еще
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-600">
                Нет заказов за выбранный период
              </div>
            )}
              </>
            )}
          </div>
        )}

        {(availableOrders?.length === 0 || !availableOrders) && activeOrders.length === 0 && completedOrders.length === 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <p className="text-gray-600 text-center">Пока нет заказов</p>
          </div>
        )}
      </div>
    </div>
  )
}
