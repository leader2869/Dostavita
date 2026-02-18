'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'
import { OrderMap } from '@/components/map/OrderMap'
import { DriverLocationMap } from '@/components/map/DriverLocationMap'
import { OrderActions } from '@/components/driver/OrderActions'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'

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
        try {
          // Используем RPC функцию для безопасного получения профиля водителя
          const { data: driverData, error: driverError } = await supabase
            .rpc('get_driver_profile_for_client', {
              p_driver_id: orderData.executor_user_id,
              p_order_id: orderData.id,
            })

          if (!driverError && driverData && driverData.length > 0) {
            setDriver(driverData[0])
          } else if (driverError) {
            console.warn('Ошибка загрузки профиля водителя через RPC:', driverError)
            // Пробуем прямой запрос как fallback (если RPC не работает)
            const { data: directDriverData, error: directError } = await supabase
              .from('profiles')
              .select('id, full_name, phone, vehicle_type, vehicle_brand, vehicle_model, vehicle_number')
              .eq('id', orderData.executor_user_id)
              .maybeSingle()
            
            if (!directError && directDriverData) {
              setDriver(directDriverData)
            } else if (directError) {
              console.warn('Ошибка загрузки профиля водителя через прямой запрос:', directError)
            }
          }
        } catch (driverErr: any) {
          console.warn('Ошибка при загрузке данных водителя:', driverErr)
          // Продолжаем работу без информации о водителе
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
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
        <ClientBottomNavigation />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="pb-20">
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <p className="text-red-400">{error || 'Заказ не найден'}</p>
          <button
            onClick={() => router.push('/dashboard/client/orders')}
            className="mt-4 bg-gray-100 text-gray-900 px-4 py-2 rounded hover:bg-gray-100"
          >
            Вернуться к заказам
          </button>
        </div>
        <ClientBottomNavigation />
      </div>
    )
  }

  // Функция для парсинга координат POINT из Supabase
  const parseCoordinates = (coords: any): { lat: number; lon: number } | undefined => {
    if (!coords) return undefined

    try {
      // Если это уже объект с lat и lon
      if (typeof coords === 'object' && 'lat' in coords && 'lon' in coords) {
        return { lat: coords.lat, lon: coords.lon }
      }

      // Если это объект с координатами в массиве (GeoJSON формат)
      if (typeof coords === 'object' && 'coordinates' in coords && Array.isArray(coords.coordinates)) {
        return { lat: coords.coordinates[1], lon: coords.coordinates[0] }
      }

      // Если это строка в формате "(lon,lat)"
      if (typeof coords === 'string') {
        // Пробуем парсить как JSON
        try {
          const parsed = JSON.parse(coords)
          if (typeof parsed === 'object' && 'lat' in parsed && 'lon' in parsed) {
            return parsed
          }
        } catch (e) {
          // Не JSON, пробуем парсить как "(lon,lat)"
          const match = coords.match(/\(([^,]+),\s*([^)]+)\)/)
          if (match && match.length === 3) {
            return { lat: parseFloat(match[2]), lon: parseFloat(match[1]) }
          }
          // Пробуем парсить как WKT формат "POINT(lon lat)"
          const wktMatch = coords.match(/POINT\(([^ ]+) ([^ ]+)\)/)
          if (wktMatch && wktMatch.length === 3) {
            return { lat: parseFloat(wktMatch[2]), lon: parseFloat(wktMatch[1]) }
          }
        }
      }
    } catch (e) {
      console.error('Ошибка парсинга координат:', e, coords)
    }

    return undefined
  }

  // Проверяем, можно ли редактировать заказ
  const canEdit = order.status === 'searching_courier' && !order.executor_user_id

  // Парсим координаты
  const pickupCoords = parseCoordinates(order.pickup_coordinates)
  const deliveryCoords = parseCoordinates(order.delivery_coordinates)

  return (
    <div className="pb-20">

      <div className="bg-gray-50 rounded-lg shadow p-6 space-y-4">
        {/* Информация о водителе (если заказ принят) - в самом верху */}
        {order.executor_user_id && (
          <div className="border-b border-gray-200 pb-4 mb-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Информация о водителе</h2>
            
            {driver ? (
              <div className="space-y-3 bg-gray-100 rounded-lg p-4">
                {driver.full_name && (
                  <div>
                    <p className="text-sm text-gray-600">Имя водителя</p>
                    <p className="text-gray-900 font-medium">{driver.full_name}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-600">Телефон</p>
                  {driver.phone ? (
                    <p className="text-gray-900">
                      <a href={`tel:${driver.phone}`} className="text-brand-light hover:text-brand-light font-medium text-lg">
                        {driver.phone}
                      </a>
                    </p>
                  ) : (
                    <p className="text-yellow-400">Телефон не указан водителем</p>
                  )}
                </div>

                {driver.vehicle_type && (
                  <div>
                    <p className="text-sm text-gray-600">Транспорт</p>
                    <p className="text-gray-900">
                      {driver.vehicle_type === 'car' ? 'Легковой автомобиль' :
                       driver.vehicle_type === 'motorcycle' ? 'Мотоцикл' :
                       driver.vehicle_type === 'bicycle' ? 'Велосипед' :
                       driver.vehicle_type === 'walking' ? 'Пешком' :
                       driver.vehicle_type}
                      {driver.vehicle_brand && driver.vehicle_model && (
                        <span className="ml-1 text-gray-700">({driver.vehicle_brand} {driver.vehicle_model})</span>
                      )}
                    </p>
                  </div>
                )}

                {driver.vehicle_number && (
                  <div>
                    <p className="text-sm text-gray-600">Номер транспорта</p>
                    <p className="text-gray-900 font-medium">{driver.vehicle_number}</p>
                  </div>
                )}

                {driver.current_location && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Местоположение водителя</p>
                    <DriverLocationMap
                      driverId={order.executor_user_id}
                      orderId={order.id}
                      height="300px"
                      showUserLocation={false}
                    />
                  </div>
                )}

                {/* Кнопки действий (телефон, навигация, чат) */}
                <div className="mt-4">
                  <OrderActions order={order} />
                </div>
              </div>
            ) : (
              <p className="text-gray-600">Загрузка информации о водителе...</p>
            )}
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Информация о заказе</h2>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Номер заказа</p>
              <p className="text-gray-900 font-medium">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Статус</p>
              <p className="text-gray-900">{getStatusLabel(order.status)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Адрес отправления</p>
              <p className="text-gray-900">{formatAddressForOrder(order.pickup_address)}</p>
              {(order.pickup_entrance || order.pickup_floor || order.pickup_apartment) && (
                <p className="text-sm text-gray-700 mt-1">
                  {order.pickup_entrance && `Подъезд ${order.pickup_entrance}`}
                  {order.pickup_entrance && (order.pickup_floor || order.pickup_apartment) && ', '}
                  {order.pickup_floor && `Этаж ${order.pickup_floor}`}
                  {order.pickup_floor && order.pickup_apartment && ', '}
                  {order.pickup_apartment && `Квартира ${order.pickup_apartment}`}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-600">Адрес доставки</p>
              <p className="text-gray-900">{formatAddressForOrder(order.delivery_address)}</p>
              {(order.delivery_entrance || order.delivery_floor || order.delivery_apartment) && (
                <p className="text-sm text-gray-700 mt-1">
                  {order.delivery_entrance && `Подъезд ${order.delivery_entrance}`}
                  {order.delivery_entrance && (order.delivery_floor || order.delivery_apartment) && ', '}
                  {order.delivery_floor && `Этаж ${order.delivery_floor}`}
                  {order.delivery_floor && order.delivery_apartment && ', '}
                  {order.delivery_apartment && `Квартира ${order.delivery_apartment}`}
                </p>
              )}
            </div>

            {order.recipient_phone && (
              <div>
                <p className="text-sm text-gray-600">Телефон получателя</p>
                <p className="text-gray-900">
                  <a href={`tel:${order.recipient_phone}`} className="text-brand-light hover:text-brand-light font-medium">
                    {order.recipient_phone}
                  </a>
                </p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-600">Тип груза</p>
              <p className="text-gray-900">{getItemTypeLabel(order.item_type)}</p>
            </div>

            {order.description && (
              <div>
                <p className="text-sm text-gray-600">Описание</p>
                <p className="text-gray-900">{order.description}</p>
              </div>
            )}

            {order.ready_at && (() => {
              const { formattedTime, timeStatus, statusType } = formatReadyTime(order.ready_at)
              return (
                <div>
                  <p className="text-sm text-gray-600">Заказ будет готов к выдаче</p>
                  <p className="text-gray-900">
                    {formattedTime}
                    {timeStatus && (
                      <span className={`ml-2 ${statusType === 'waiting' ? 'text-red-400 animate-blink' : statusType === 'upcoming' ? 'text-yellow-400 animate-blink' : 'text-gray-600'}`}>
                        ({timeStatus})
                      </span>
                    )}
                  </p>
                </div>
              )
            })()}

            <div>
              <p className="text-sm text-gray-600">Стоимость</p>
              <p className="text-gray-900 text-xl font-semibold">{order.final_price} BYN</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Дата создания</p>
              <p className="text-gray-900">
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

        {/* Карта с маршрутом */}
        {(pickupCoords || deliveryCoords) && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-900">Карта маршрута</h3>
            <OrderMap
              pickupCoordinates={pickupCoords}
              deliveryCoordinates={deliveryCoords}
              height="400px"
              showRoute={true}
            />
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t border-gray-200">
          {canEdit && (
            <button
              onClick={() => router.push(`/dashboard/client/orders/${order.id}/edit`)}
              className="flex-1 bg-brand-light text-gray-900 px-4 py-2 rounded-md hover:bg-brand-dark transition"
            >
              Редактировать
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/client/orders')}
            className={`${canEdit ? 'flex-1' : 'w-full'} bg-gray-100 text-gray-900 px-4 py-2 rounded-md hover:bg-gray-100 transition`}
          >
            Вернуться к заказам
          </button>
        </div>
      </div>

      <ClientBottomNavigation />
    </div>
  )
}

