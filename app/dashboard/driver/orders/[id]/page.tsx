'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'
import { BackButton } from '@/components/ui/BackButton'
import { OrderActions } from '@/components/driver/OrderActions'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'

export default function OrderDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const supabase = createClient()
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOrder = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Загружаем заказ и проверяем, что он принадлежит текущему водителю
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('executor_user_id', user.id)
        .single()

      if (fetchError) throw fetchError
      setOrder(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orderId, supabase, router])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  const handleStartComing = async () => {
    setProcessing(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('start_coming_to_pickup', {
        order_uuid: orderId,
      })

      if (rpcError) throw rpcError

      if (data === false) {
        throw new Error('Не удалось начать движение к отправителю')
      }

      await loadOrder()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handlePickup = async () => {
    setProcessing(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('pickup_order', {
        order_uuid: orderId,
      })

      if (rpcError) throw rpcError

      if (data === false) {
        throw new Error('Не удалось отметить заказ как забранный')
      }

      await loadOrder()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleComplete = async () => {
    setProcessing(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('complete_order', {
        order_uuid: orderId,
      })

      if (rpcError) throw rpcError

      if (data === false) {
        throw new Error('Не удалось завершить заказ')
      }

      // После успешного завершения заказа переходим на главную страницу
      router.push('/dashboard/driver')
    } catch (err: any) {
      setError(err.message)
      setProcessing(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>
  }

  if (!order) {
    return <div className="text-center py-8 text-red-600">Заказ не найден</div>
  }

  const canStartComing = order.status === 'courier_accepted'
  const canPickup = order.status === 'courier_coming'
  const canComplete = order.status === 'courier_delivering'

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Детали заказа</h1>

      <div className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="font-semibold mb-2 text-white">Статус</h2>
          <p className="text-lg text-white">
            {order.status === 'searching_courier' && 'Ищем курьера'}
            {order.status === 'courier_accepted' && 'Курьер принял заказ'}
            {order.status === 'courier_coming' && 'Курьер едет к отправителю'}
            {order.status === 'courier_delivering' && 'Курьер едет к получателю'}
            {order.status === 'completed' && 'Заказ завершен'}
            {order.status === 'cancelled' && 'Отменен'}
          </p>
        </div>

        <div>
          <h2 className="font-semibold mb-2 text-white">Адреса</h2>
          <div className="mb-3">
            <p className="text-white"><strong className="text-white">Откуда:</strong> {formatAddressForOrder(order.pickup_address)}</p>
            {(order.pickup_entrance || order.pickup_floor || order.pickup_apartment) && (
              <p className="text-sm text-gray-300 mt-1 ml-4">
                {order.pickup_entrance && `Подъезд ${order.pickup_entrance}`}
                {order.pickup_entrance && (order.pickup_floor || order.pickup_apartment) && ', '}
                {order.pickup_floor && `Этаж ${order.pickup_floor}`}
                {order.pickup_floor && order.pickup_apartment && ', '}
                {order.pickup_apartment && `Квартира ${order.pickup_apartment}`}
              </p>
            )}
          </div>
          <div>
            <p className="text-white"><strong className="text-white">Куда:</strong> {formatAddressForOrder(order.delivery_address)}</p>
            {(order.delivery_entrance || order.delivery_floor || order.delivery_apartment) && (
              <p className="text-sm text-gray-300 mt-1 ml-4">
                {order.delivery_entrance && `Подъезд ${order.delivery_entrance}`}
                {order.delivery_entrance && (order.delivery_floor || order.delivery_apartment) && ', '}
                {order.delivery_floor && `Этаж ${order.delivery_floor}`}
                {order.delivery_floor && order.delivery_apartment && ', '}
                {order.delivery_apartment && `Квартира ${order.delivery_apartment}`}
              </p>
            )}
            {order.sender_phone && (
              <p className="text-sm text-gray-300 mt-1 ml-4">
                <strong>Телефон отправителя:</strong>{' '}
                <a href={`tel:${order.sender_phone}`} className="text-green-500 hover:text-green-400 font-medium">
                  {order.sender_phone}
                </a>
              </p>
            )}
            {order.recipient_phone && (
              <p className="text-sm text-gray-300 mt-1 ml-4">
                <strong>Телефон получателя:</strong>{' '}
                <a href={`tel:${order.recipient_phone}`} className="text-green-500 hover:text-green-400 font-medium">
                  {order.recipient_phone}
                </a>
              </p>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-2 text-white">Информация о заказе</h2>
          <p className="text-white"><strong className="text-white">Тип груза:</strong> {
            order.item_type === 'documents' ? 'Документы' :
            order.item_type === 'parcel' ? 'Посылка' :
            order.item_type === 'flowers' ? 'Цветы' :
            order.item_type === 'food' ? 'Еда' : 'Не указан'
          }</p>
          {order.description && (
            <p className="text-white"><strong className="text-white">Описание:</strong> {order.description}</p>
          )}
          {order.ready_at && (
            <p className="text-white mt-2">
              <strong className="text-white">Заказ будет готов к:</strong>{' '}
              {new Date(order.ready_at).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
          <p className="text-xl font-bold mt-4 text-white">Стоимость: {order.final_price} BYN</p>
          
          {/* Временные метки изменений статусов */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-white">История изменений статуса</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-400">Время создания заказа</p>
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

              {order.accepted_at && (
                <div>
                  <p className="text-sm text-gray-400">Время принятия заказа</p>
                  <p className="text-white">
                    {new Date(order.accepted_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              {order.started_coming_at && (
                <div>
                  <p className="text-sm text-gray-400">Время начала движения к отправителю</p>
                  <p className="text-white">
                    {new Date(order.started_coming_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              {order.picked_up_at && (
                <div>
                  <p className="text-sm text-gray-400">Время когда водитель забрал заказ</p>
                  <p className="text-white">
                    {new Date(order.picked_up_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              {order.completed_at && (
                <div>
                  <p className="text-sm text-gray-400">Время завершения заказа</p>
                  <p className="text-white">
                    {new Date(order.completed_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Кнопки действий (телефон, навигация, чат) */}
        {order && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <OrderActions order={order} />
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex gap-4 pt-4">
          {canStartComing && (
            <button
              onClick={handleStartComing}
              disabled={processing}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? 'Обработка...' : 'Начать движение к отправителю'}
            </button>
          )}

          {canPickup && (
            <button
              onClick={handlePickup}
              disabled={processing}
              className="flex-1 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {processing ? 'Обработка...' : 'Забрал заказ'}
            </button>
          )}

          {canComplete && (
            <button
              onClick={handleComplete}
              disabled={processing}
              className="flex-1 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {processing ? 'Обработка...' : 'Завершить заказ'}
            </button>
          )}

          {order.status === 'completed' && (
            <div className="flex-1 bg-green-600/20 border border-green-500 rounded p-4 text-center">
              <p className="text-green-400 font-semibold">Заказ завершен</p>
            </div>
          )}

          <button
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-600 rounded-md hover:bg-gray-900 text-white"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  )
}
