'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'

export default function OrderDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const supabase = createClient()
  const [order, setOrder] = useState<any>(null)
  const [driver, setDriver] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOrder = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderError) {
        setError('Заказ не найден')
        setLoading(false)
        return
      }

      // Проверяем, что заказ принадлежит пользователю
      if (orderData.customer_id !== user.id && orderData.client_id !== user.id) {
        setError('У вас нет доступа к этому заказу')
        setLoading(false)
        return
      }

      setOrder(orderData)

      // Если заказ принят водителем, загружаем информацию о водителе
      if (orderData.executor_user_id) {
        const { data: driverData, error: driverError } = await supabase
          .from('profiles')
          .select('id, full_name, phone, vehicle_type, vehicle_number')
          .eq('id', orderData.executor_user_id)
          .single()

        if (!driverError && driverData) {
          setDriver(driverData)
        }
      }
    } catch (err: any) {
      console.error('Ошибка загрузки заказа:', err)
      setError(err.message || 'Ошибка загрузки заказа')
    } finally {
      setLoading(false)
    }
  }, [orderId, supabase, router])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'searching_courier':
        return 'Ищем курьера'
      case 'courier_coming':
        return 'Курьер едет к вам'
      case 'courier_delivering':
        return 'Курьер доставляет заказ'
      case 'completed':
        return 'Заказ завершен'
      case 'cancelled':
        return 'Отменен'
      default:
        return status
    }
  }

  const getItemTypeLabel = (itemType: string | null) => {
    switch (itemType) {
      case 'documents':
        return 'Документы'
      case 'parcel':
        return 'Посылка'
      case 'flowers':
        return 'Цветы'
      case 'food':
        return 'Еда'
      case 'other':
        return 'Другое'
      default:
        return 'Не указан'
    }
  }

  if (loading) {
    return (
      <div className="pb-20">
        <div className="text-center py-8 text-gray-400">Загрузка...</div>
        <ClientBottomNavigation />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="pb-20">
        <h1 className="text-3xl font-bold mb-6 text-white">Детали заказа</h1>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <p className="text-red-400">{error || 'Заказ не найден'}</p>
          <button
            onClick={() => router.push('/dashboard/client/orders')}
            className="mt-4 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Вернуться к заказам
          </button>
        </div>
        <ClientBottomNavigation />
      </div>
    )
  }

  // Проверяем, можно ли редактировать заказ
  const canEdit = order.status === 'searching_courier' && !order.executor_user_id

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-6 text-white">Детали заказа</h1>

      <div className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-4 text-white">Информация о заказе</h2>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-400">Номер заказа</p>
              <p className="text-white font-medium">#{order.id.slice(0, 8)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Статус</p>
              <p className="text-white">{getStatusLabel(order.status)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Адрес отправления</p>
              <p className="text-white">{order.pickup_address}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Адрес доставки</p>
              <p className="text-white">{order.delivery_address}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Тип груза</p>
              <p className="text-white">{getItemTypeLabel(order.item_type)}</p>
            </div>

            {order.description && (
              <div>
                <p className="text-sm text-gray-400">Описание</p>
                <p className="text-white">{order.description}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-400">Стоимость</p>
              <p className="text-white text-xl font-semibold">{order.final_price} BYN</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Дата создания</p>
              <p className="text-white">
                {new Date(order.created_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Информация о водителе (если заказ принят) */}
        {order.executor_user_id && driver && (
          <div className="border-t border-gray-700 pt-4">
            <h2 className="text-xl font-semibold mb-4 text-white">Информация о водителе</h2>
            
            <div className="space-y-3 bg-gray-700 rounded-lg p-4">
              {driver.full_name && (
                <div>
                  <p className="text-sm text-gray-400">Имя водителя</p>
                  <p className="text-white font-medium">{driver.full_name}</p>
                </div>
              )}

              {driver.phone && (
                <div>
                  <p className="text-sm text-gray-400">Телефон</p>
                  <p className="text-white">
                    <a href={`tel:${driver.phone}`} className="text-green-500 hover:text-green-400">
                      {driver.phone}
                    </a>
                  </p>
                </div>
              )}

              {driver.vehicle_type && (
                <div>
                  <p className="text-sm text-gray-400">Тип транспорта</p>
                  <p className="text-white">
                    {driver.vehicle_type === 'car' ? 'Легковой автомобиль' :
                     driver.vehicle_type === 'motorcycle' ? 'Мотоцикл' :
                     driver.vehicle_type === 'bicycle' ? 'Велосипед' :
                     driver.vehicle_type === 'walking' ? 'Пешком' :
                     driver.vehicle_type}
                  </p>
                </div>
              )}

              {driver.vehicle_number && (
                <div>
                  <p className="text-sm text-gray-400">Номер транспорта</p>
                  <p className="text-white font-medium">{driver.vehicle_number}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t border-gray-700">
          {canEdit && (
            <button
              onClick={() => router.push(`/dashboard/client/orders/${order.id}/edit`)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Редактировать
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/client/orders')}
            className={`${canEdit ? 'flex-1' : 'w-full'} bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition`}
          >
            Вернуться к заказам
          </button>
        </div>
      </div>

      <ClientBottomNavigation />
    </div>
  )
}

