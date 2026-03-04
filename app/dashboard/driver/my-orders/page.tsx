'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthCheck } from '@/hooks/useAuthCheck'
import { useDateFilter } from '@/hooks/useDateFilter'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { getOrderStatusLabel, getOrderStatusColor, isActiveOrderStatus } from '@/lib/utils/orderStatus'
import { OrderActions } from '@/components/driver/OrderActions'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'

export default function DriverMyOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuthCheck()
  const { period, setPeriod, getDateFilter } = useDateFilter('week')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [displayedCount, setDisplayedCount] = useState(10)

  const loadOrders = useCallback(async () => {
    if (!user) return

    let isMounted = true
    setLoading(true)

    try {
      const dateFilter = getDateFilter()
      
      let query = supabase
        .from('orders')
        .select('*')
        .eq('executor_user_id', user.id)
        .order('created_at', { ascending: false })

      // Применяем фильтр по дате, если выбран период
      if (dateFilter.start != null && dateFilter.end != null) {
        query = query
          .gte('created_at', dateFilter.start)
          .lte('created_at', dateFilter.end)
      }

      const { data: ordersData, error } = await query

      if (!isMounted) return

      if (error) {
        console.error('Ошибка загрузки заказов:', error)
        setOrders([])
      } else {
        const loadedOrders = ordersData || []
        setOrders(loadedOrders)
        // Сбрасываем счетчик отображаемых заказов при смене периода
        setDisplayedCount(10)
      }
    } catch (err) {
      console.error('Ошибка загрузки заказов:', err)
      if (isMounted) {
        setOrders([])
      }
    } finally {
      if (isMounted) {
        setLoading(false)
      }
    }

    return () => {
      isMounted = false
    }
  }, [user, period, supabase, getDateFilter])

  useEffect(() => {
    if (authLoading || !user) return
    loadOrders()
  }, [authLoading, user, period, loadOrders])

  const shouldBlink = (status: string) => isActiveOrderStatus(status)

  // Разделяем заказы на активные и завершенные
  const activeOrders = orders.filter(order => 
    order.status !== 'completed' && order.status !== 'cancelled'
  )
  const completedOrders = orders.filter(order => 
    order.status === 'completed' || order.status === 'cancelled'
  )

  // Ограничиваем количество отображаемых заказов
  const displayedOrders = completedOrders.slice(0, displayedCount)
  const hasMore = completedOrders.length > displayedCount

  const handleLoadMore = () => {
    setDisplayedCount(prev => prev + 10)
  }

  const renderOrderCard = (order: any) => {
    // Показываем кнопки только для активных заказов
    const isActive = order.status === 'courier_accepted' || order.status === 'courier_coming' || order.status === 'courier_delivering'
    // Легкая зеленая заливка для завершенных оплаченных заказов
    const isCompletedAndPaid = order.status === 'completed' && order.is_paid === true
    // Легкая красная заливка для неоплаченных заказов
    const isUnpaid = order.status === 'completed' && (order.is_paid === false || order.is_paid === null)
    // Легкая красная заливка для отмененных заказов
    const isCancelled = order.status === 'cancelled'
    
    return (
      <div
        key={order.id}
        className={`rounded-lg shadow p-6 border border-gray-200 hover:border-green-500 transition ${
          isCancelled
            ? 'bg-red-100/40'
            : isCompletedAndPaid 
            ? 'bg-green-100/40' 
            : isUnpaid 
            ? 'bg-red-100/40' 
            : 'bg-gray-50'
        }`}
      >
        <div
          className="cursor-pointer"
          onClick={() => router.push(`/dashboard/driver/orders/${order.id}`)}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  Заказ №{order.order_number || order.id.slice(0, 8)}
                </h3>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                    getOrderStatusColor(order.status)
                  } ${shouldBlink(order.status) ? 'animate-blink' : ''}`}
                >
                  {getOrderStatusLabel(order.status)}
                </span>
                {isUnpaid && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold border bg-red-200/50 text-red-700 border-red-300/50">
                    Не оплачен
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 mb-1">
                <span className="font-medium">Откуда:</span> {formatAddressForOrder(order.pickup_address)}
              </p>
              <p className="text-sm text-gray-700 mb-1">
                <span className="font-medium">Куда:</span> {formatAddressForOrder(order.delivery_address)}
              </p>
              {order.item_type && (
                <p className="text-sm text-gray-600 mt-2">
                  Тип груза: <span className="text-gray-700">
                    {order.item_type === 'documents' ? 'Документы' :
                     order.item_type === 'parcel' ? 'Посылка' :
                     order.item_type === 'flowers' ? 'Цветы' :
                     order.item_type === 'food' ? 'Еда' :
                     order.item_type === 'other' ? 'Другое' : 'Не указан'}
                  </span>
                </p>
              )}
              {order.description && (
                <p className="text-sm text-gray-600 mt-1 italic">
                  {order.description}
                </p>
              )}
              {order.ready_at && order.status !== 'completed' && order.status !== 'cancelled' && (() => {
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
            </div>
            <div className="text-right ml-4">
              <p className="text-xl font-bold text-gray-900 mb-2">
                {order.final_price} BYN
              </p>
            </div>
          </div>
        </div>
        {isActive && (
          <OrderActions order={order} />
        )}
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="pb-20">
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <p className="text-gray-600 text-center">Проверка аутентификации...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Редирект будет выполнен в useAuthCheck
  }

  return (
    <div className="pb-20">
      {/* Выбор периода */}
      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setPeriod('today')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'today'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Сегодня
          </button>
          <button
            onClick={() => setPeriod('yesterday')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'yesterday'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Вчера
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'week'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Неделя
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'all'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Все
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <p className="text-gray-600 text-center">Загрузка...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Заказы */}
          {completedOrders.length > 0 && (
            <div className="bg-gray-50 rounded-lg shadow p-6">
              <div className="space-y-4">
                {displayedOrders.map(renderOrderCard)}
              </div>
              
              {/* Кнопка "Загрузить еще" */}
              {hasMore && (
                <div className="mt-4 text-center">
                  <button
                    onClick={handleLoadMore}
                    className="bg-brand-light hover:bg-brand-dark text-gray-900 px-6 py-2 rounded-md transition"
                  >
                    Загрузить еще
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Если нет заказов вообще */}
          {orders.length === 0 && (
            <div className="bg-gray-50 rounded-lg shadow p-6">
              <p className="text-gray-600 text-center">У вас пока нет заказов за выбранный период</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

