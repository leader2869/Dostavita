'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'
import { ClientOrderActions } from '@/components/client/ClientOrderActions'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'
import { exportOrdersToExcel } from '@/lib/utils/exportToExcel'

export default function ClientOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    
    const loadOrders = async () => {
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

      // Получаем все заказы, где пользователь является отправителем или получателем
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .or(`customer_id.eq.${user.id},client_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (!isMounted) return

      if (error) {
        console.error('Ошибка загрузки заказов:', error)
      } else {
        setOrders(ordersData || [])
      }
      
      setLoading(false)
    }

    loadOrders()
    
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Убрали supabase и router из зависимостей

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

  // Разделяем заказы на активные и завершенные
  const activeOrders = orders.filter(order => 
    order.status !== 'completed' && order.status !== 'cancelled'
  )
  const completedOrders = orders.filter(order => 
    order.status === 'completed' || order.status === 'cancelled'
  )

  const renderOrderCard = (order: any) => {
    // Проверяем, можно ли редактировать заказ
    const canEdit = order.status === 'searching_courier' && !order.executor_user_id
    
    return (
      <div
        key={order.id}
        className="border border-gray-200 bg-gray-100 rounded-lg p-4 hover:bg-gray-100 transition cursor-pointer relative"
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
            <div className="mt-2">
              <span className="text-sm text-gray-600">Статус: </span>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                  getStatusColor(order.status)
                } ${shouldBlink(order.status) ? 'animate-blink' : ''}`}
              >
                {getStatusLabel(order.status)}
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
              className="flex-1 bg-red-600 text-gray-900 px-3 py-1.5 rounded text-xs hover:bg-red-700 transition"
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Мои заказы</h1>
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

      {loading ? (
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <p className="text-gray-600">Загрузка...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Активные заказы */}
          {activeOrders.length > 0 && (
            <div className="bg-gray-50 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Активные заказы ({activeOrders.length})
              </h2>
              <div className="space-y-4">
                {activeOrders.map(renderOrderCard)}
              </div>
            </div>
          )}

          {/* Завершенные заказы */}
          {completedOrders.length > 0 && (
            <div className="bg-gray-50 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                Завершенные заказы ({completedOrders.length})
              </h2>
              <div className="space-y-4">
                {completedOrders.map(renderOrderCard)}
              </div>
            </div>
          )}

          {/* Если нет заказов вообще */}
          {orders.length === 0 && (
            <div className="bg-gray-50 rounded-lg shadow p-6">
              <p className="text-gray-600">У вас пока нет заказов</p>
            </div>
          )}
        </div>
      )}

      <ClientBottomNavigation />
    </div>
  )
}

