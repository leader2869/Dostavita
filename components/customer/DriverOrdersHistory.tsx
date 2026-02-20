'use client'

import { useState } from 'react'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'

type Period = 'today' | 'week' | 'month' | 'all'

interface DriverOrdersHistoryProps {
  completedOrders: any[]
}

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

export function DriverOrdersHistory({
  completedOrders
}: DriverOrdersHistoryProps) {
  const [displayedCount, setDisplayedCount] = useState(10)
  const [period, setPeriod] = useState<Period>('week')

  const getDateFilter = (period: Period) => {
    const now = new Date()
    switch (period) {
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        return { start: todayStart, end: todayEnd }
      case 'week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - 7)
        weekStart.setHours(0, 0, 0, 0)
        return { start: weekStart, end: now }
      case 'month':
        const monthStart = new Date(now)
        monthStart.setMonth(now.getMonth() - 1)
        monthStart.setHours(0, 0, 0, 0)
        return { start: monthStart, end: now }
      case 'all':
      default:
        return { start: null, end: null }
    }
  }

  const filterOrdersByPeriod = (orders: any[], period: Period) => {
    if (period === 'all') return orders
    
    const { start, end } = getDateFilter(period)
    return orders.filter((order: any) => {
      if (!order.completed_at) return false
      const completedDate = new Date(order.completed_at)
      if (start && completedDate < start) return false
      if (end && completedDate > end) return false
      return true
    })
  }

  const filteredOrders = filterOrdersByPeriod(completedOrders, period)
  const displayedOrders = filteredOrders.slice(0, displayedCount)
  const hasMore = displayedCount < filteredOrders.length

  const handleLoadMore = () => {
    setDisplayedCount(prev => prev + 10)
  }

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod)
    setDisplayedCount(10) // Сбрасываем счетчик при смене фильтра
  }

  if (completedOrders.length === 0) {
    return null
  }

  return (
    <div className="bg-gray-50 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          История заказов ({filteredOrders.length})
        </h2>
        {/* Фильтр по периоду */}
        <div className="flex gap-2">
          <button
            onClick={() => handlePeriodChange('today')}
            className={`px-3 py-1 rounded text-sm transition ${
              period === 'today'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Сегодня
          </button>
          <button
            onClick={() => handlePeriodChange('week')}
            className={`px-3 py-1 rounded text-sm transition ${
              period === 'week'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Неделя
          </button>
          <button
            onClick={() => handlePeriodChange('month')}
            className={`px-3 py-1 rounded text-sm transition ${
              period === 'month'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Месяц
          </button>
          <button
            onClick={() => handlePeriodChange('all')}
            className={`px-3 py-1 rounded text-sm transition ${
              period === 'all'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Все
          </button>
        </div>
      </div>

      {displayedOrders.length > 0 ? (
        <>
          <div className="space-y-4">
            {displayedOrders.map((order: any) => (
              <div key={order.id} className="border border-gray-200 rounded-lg p-4 bg-gray-100 hover:bg-gray-100 transition">
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
                          getStatusColor(order.status)
                        }`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    {order.completed_at && (
                      <p className="text-sm text-gray-600 mt-2">
                        Завершен: {new Date(order.completed_at).toLocaleString('ru-RU')}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-gray-900 text-lg">{order.final_price} BYN</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={handleLoadMore}
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
    </div>
  )
}

