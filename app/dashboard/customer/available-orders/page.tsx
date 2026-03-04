'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'
import { getOrderStatusLabel, getOrderStatusColor } from '@/lib/utils/orderStatus'
import { toastError } from '@/lib/utils/toast'
import { useDashboardUser } from '@/contexts/DashboardAuthContext'

export default function AvailableOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const { userId, profile } = useDashboardUser()
  
  const [loading, setLoading] = useState(true)
  const [availableOrders, setAvailableOrders] = useState<any[]>([])
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [driverIds, setDriverIds] = useState<string[]>([])
  const [assigningDriver, setAssigningDriver] = useState<string | null>(null)
  const [selectedDriverForOrder, setSelectedDriverForOrder] = useState<{ [orderId: string]: string }>({})

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

      // Получаем все доступные заказы от клиентов (searching_courier) - все публичные заказы, которые еще не приняты
      const { data: available } = await supabase
        .from('orders')
        .select(`
          *,
          client:profiles!orders_client_id_fkey(id, full_name, phone),
          customer:profiles!orders_customer_id_fkey(id, full_name, phone)
        `)
        .eq('status', 'searching_courier')
        .order('created_at', { ascending: false })

      setAvailableOrders(available || [])

      // Получаем активные заказы всех водителей организации
      let active: any[] = []
      if (ids.length > 0) {
        const { data: orders } = await supabase
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
        
        active = (orders || []).map((order: any) => ({
          ...order,
          driver_full_name: order.executor?.full_name,
          driver_phone: order.executor?.phone
        }))
      }
      setActiveOrders(active)
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, userId, profile.role])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Компонент для отображения схемы статусов с временем
  const StatusTimeline = ({ order }: { order: any }) => {
    const stages = [
      { 
        id: 1, 
        label: 'Заказ создан', 
        status: 'searching_courier',
        time: order.created_at ? new Date(order.created_at) : null
      },
      { 
        id: 2, 
        label: 'Курьер принял', 
        status: 'courier_accepted',
        time: order.accepted_at ? new Date(order.accepted_at) : null
      },
      { 
        id: 3, 
        label: 'Едет к отправителю', 
        status: 'courier_coming',
        time: order.started_coming_at ? new Date(order.started_coming_at) : null
      },
      { 
        id: 4, 
        label: 'Едет к получателю', 
        status: 'courier_delivering',
        time: order.picked_up_at || order.started_delivery_at 
          ? new Date(order.picked_up_at || order.started_delivery_at) 
          : null
      },
      { 
        id: 5, 
        label: 'Завершен', 
        status: 'completed',
        time: order.completed_at ? new Date(order.completed_at) : null
      },
    ]

    const getCurrentStage = () => {
      if (order.status === 'cancelled') return 0
      const stageIndex = stages.findIndex(s => s.status === order.status)
      return stageIndex >= 0 ? stageIndex + 1 : 0
    }

    const currentStage = getCurrentStage()

    const formatTime = (date: Date | null) => {
      if (!date) return null
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    return (
      <div className="w-full py-3">
        <div className="relative">
          {/* Фоновая линия - остается светлой при наведении */}
          <div className="absolute top-3 left-0 right-0 h-1 bg-gray-200 rounded-full group-hover:bg-gray-300 transition-colors"></div>
          
          {/* Прогресс линия с тенью для лучшей видимости */}
          <div
            className="absolute top-3 left-0 h-1 bg-green-500 rounded-full transition-all duration-500 shadow-sm z-10"
            style={{ 
              width: currentStage === 0 
                ? '0%' 
                : currentStage === stages.length
                ? '100%'
                : `${((currentStage - 1) / (stages.length - 1)) * 100}%`,
              boxShadow: '0 0 2px rgba(34, 197, 94, 0.5)'
            }}
          ></div>

          {/* Кружочки с этапами */}
          <div className="relative flex justify-between">
            {stages.map((stage, index) => {
              const isActive = index + 1 <= currentStage
              const isCurrent = index + 1 === currentStage
              const hasTime = stage.time !== null

              return (
                <div key={stage.id} className="flex flex-col items-center flex-1">
                  <div
                    className={`relative w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all z-10 ${
                      isActive
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    } ${isCurrent ? 'ring-2 ring-green-300' : ''}`}
                  >
                    {isActive ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-[8px] font-bold">{stage.id}</span>
                    )}
                  </div>
                  
                  {/* Подпись этапа */}
                  <p
                    className={`text-[10px] mt-1 text-center leading-tight ${
                      isActive ? 'text-gray-900 font-semibold' : 'text-gray-500'
                    }`}
                  >
                    {stage.label}
                  </p>
                  
                  {/* Время смены статуса */}
                  {hasTime && (
                    <p className="text-[9px] mt-0.5 text-gray-600 text-center">
                      {formatTime(stage.time)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
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
        {availableOrders && availableOrders.length > 0 ? (
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
                        {(order.client?.full_name || order.customer?.full_name) && (
                          <p className="text-sm text-gray-600 mt-1">
                            Клиент: <span className="text-gray-700">
                              {order.client?.full_name || order.customer?.full_name}
                            </span>
                            {(order.client?.phone || order.customer?.phone) && (
                              <span className="text-gray-600 ml-2">
                                ({order.client?.phone || order.customer?.phone})
                              </span>
                            )}
                          </p>
                        )}
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
        ) : (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <p className="text-gray-600 text-center">Пока нет доступных заказов</p>
          </div>
        )}

        {/* Активные заказы водителей */}
        {activeOrders.length > 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Активные заказы водителей ({activeOrders.length})
            </h2>
            <div className="space-y-4">
              {activeOrders.map((order: any) => (
                <a
                  key={order.id}
                  href={`/dashboard/customer/orders/${order.id}`}
                  className="block border border-gray-200 rounded-lg p-4 bg-gray-100 hover:bg-gray-200 transition cursor-pointer group"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                      {(order.client?.full_name || order.customer?.full_name) && (
                        <p className="text-sm text-gray-600 mt-1">
                          Клиент: <span className="text-gray-700">
                            {order.client?.full_name || order.customer?.full_name}
                          </span>
                          {(order.client?.phone || order.customer?.phone) && (
                            <span className="text-gray-600 ml-2">
                              ({order.client?.phone || order.customer?.phone})
                            </span>
                          )}
                        </p>
                      )}
                      <p className="text-sm text-gray-700 mt-1">
                        а) {formatAddressForOrder(order.pickup_address)}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        б) {formatAddressForOrder(order.delivery_address)}
                      </p>
                      
                      {/* Схема статусов с временем */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <StatusTimeline order={order} />
                      </div>
                      
                      {order.driver_full_name && (
                        <p className="text-sm text-gray-600 mt-2">
                          Водитель: <span className="text-gray-700">{order.driver_full_name}</span>
                          {order.driver_phone && (
                            <span className="text-gray-600 ml-2">({order.driver_phone})</span>
                          )}
                        </p>
                      )}
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
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-gray-900 text-lg">{order.final_price} BYN</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

