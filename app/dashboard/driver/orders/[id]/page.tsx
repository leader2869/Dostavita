'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'
import { BackButton } from '@/components/ui/BackButton'
import { OrderActions } from '@/components/driver/OrderActions'
import { PaymentModal } from '@/components/driver/PaymentModal'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { formatReadyTime } from '@/lib/utils/formatReadyTime'

export default function OrderDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const supabase = createClient()
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

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
      
      // Проверяем, что data.id существует и является валидным UUID
      if (!data || !data.id) {
        throw new Error('Заказ не найден или не имеет ID')
      }
      
      // Логируем для отладки
      console.log('=== Order loaded ===')
      console.log('Order ID:', data.id)
      console.log('Order ID type:', typeof data.id)
      console.log('Order data:', data)
      
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
      // Показываем модальное окно оплаты после того, как заказ забран
      // Загружаем актуальные данные заказа для проверки is_paid
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('is_paid, id')
        .eq('id', orderId)
        .single()
      
      console.log('=== After pickup_order ===')
      console.log('orderData:', orderData)
      console.log('orderError:', orderError)
      console.log('is_paid value:', orderData?.is_paid)
      console.log('is_paid type:', typeof orderData?.is_paid)
      console.log('is_paid === false:', orderData?.is_paid === false)
      console.log('is_paid === null:', orderData?.is_paid === null)
      console.log('Current order state:', order)
      console.log('Current order.id:', order?.id)
      
      // Модальное окно открывается, если оплата еще не обработана (false или null)
      const shouldOpen = orderData && (orderData.is_paid === false || orderData.is_paid === null)
      console.log('shouldOpen:', shouldOpen)
      
      if (shouldOpen) {
        console.log('✅ Opening payment modal')
        // Убеждаемся, что order.id существует и валиден перед открытием модального окна
        if (!order || !order.id || String(order.id).trim() === '0') {
          console.error('❌ Cannot open payment modal - order or order.id is missing or invalid')
          console.error('Current order state:', order)
          // Перезагружаем заказ еще раз
          await loadOrder()
          // Проверяем еще раз после перезагрузки
          if (order && order.id && String(order.id).trim() !== '0') {
            setShowPaymentModal(true)
          } else {
            setError('Ошибка: Не удалось загрузить данные заказа. Пожалуйста, обновите страницу.')
          }
        } else {
          console.log('✅ Order ID is valid:', order.id)
          setShowPaymentModal(true)
        }
      } else {
        console.log('❌ Payment modal NOT opened')
        console.log('  - orderData exists:', !!orderData)
        console.log('  - is_paid value:', orderData?.is_paid)
        console.log('  - is_paid type:', typeof orderData?.is_paid)
      }
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
      // Проверяем статус оплаты перед попыткой завершения
      const { data: orderCheck, error: checkError } = await supabase
        .from('orders')
        .select('is_paid, id')
        .eq('id', orderId)
        .single()
      
      if (checkError) throw checkError
      
      // Если оплата не обработана, проверяем наличие receivables
      if (orderCheck.is_paid === false || orderCheck.is_paid === null) {
        const { data: receivableCheck } = await supabase
          .from('receivables')
          .select('id')
          .eq('order_id', orderId)
          .maybeSingle()
        
        // Если нет ни оплаты, ни receivables - показываем модальное окно
        if (!receivableCheck) {
          console.log('⚠️ Заказ не оплачен и нет receivables. Показываем модальное окно оплаты.')
          if (order && order.id && String(order.id).trim() !== '0') {
            setShowPaymentModal(true)
            setProcessing(false)
            return
          } else {
            await loadOrder()
            if (order && order.id && String(order.id).trim() !== '0') {
              setShowPaymentModal(true)
              setProcessing(false)
              return
            } else {
              throw new Error('Не удалось загрузить данные заказа. Пожалуйста, обновите страницу.')
            }
          }
        }
      }
      
      // Если оплата обработана или есть receivables, пытаемся завершить заказ
      const { data, error: rpcError } = await supabase.rpc('complete_order', {
        order_uuid: orderId,
      })

      if (rpcError) throw rpcError

      // Проверяем результат (теперь функция возвращает JSONB)
      if (typeof data === 'object' && data !== null) {
        if (data.success === false) {
          // Если требуется обработка оплаты, показываем модальное окно
          if (data.error === 'payment_required') {
            console.log('⚠️ Требуется обработка оплаты. Показываем модальное окно.')
            if (order && order.id && String(order.id).trim() !== '0') {
              setShowPaymentModal(true)
              setProcessing(false)
              return
            } else {
              await loadOrder()
              if (order && order.id && String(order.id).trim() !== '0') {
                setShowPaymentModal(true)
                setProcessing(false)
                return
              }
            }
          }
          throw new Error(data.message || data.error || 'Не удалось завершить заказ')
        }
      } else if (data === false) {
        throw new Error('Не удалось завершить заказ')
      }

      // Заказ успешно завершен
      await loadOrder()
      router.push('/dashboard/driver')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handlePaymentSuccess = async () => {
    console.log('=== handlePaymentSuccess called ===')
    // Перезагружаем заказ, чтобы получить обновленный is_paid
    await loadOrder()
    console.log('Order reloaded after payment')
    // После успешной обработки оплаты обновляем заказ и переходим на главную страницу
    await loadOrder()
    router.push('/dashboard/driver')
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
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Детали заказа</h1>

      <div className="bg-gray-50 rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="font-semibold mb-2 text-gray-900">Статус</h2>
          <p className="text-lg text-gray-900">
            {order.status === 'searching_courier' && 'Ищем курьера'}
            {order.status === 'courier_accepted' && 'Курьер принял заказ'}
            {order.status === 'courier_coming' && 'Курьер едет к отправителю'}
            {order.status === 'courier_delivering' && 'Курьер едет к получателю'}
            {order.status === 'completed' && 'Заказ завершен'}
            {order.status === 'cancelled' && 'Отменен'}
          </p>
        </div>

        <div>
          <h2 className="font-semibold mb-2 text-gray-900">Адреса</h2>
          <div className="mb-3">
            <p className="text-gray-900"><strong className="text-gray-900">Откуда:</strong> {formatAddressForOrder(order.pickup_address)}</p>
            {(order.pickup_entrance || order.pickup_floor || order.pickup_apartment) && (
              <p className="text-sm text-gray-700 mt-1 ml-4">
                {order.pickup_entrance && `Подъезд ${order.pickup_entrance}`}
                {order.pickup_entrance && (order.pickup_floor || order.pickup_apartment) && ', '}
                {order.pickup_floor && `Этаж ${order.pickup_floor}`}
                {order.pickup_floor && order.pickup_apartment && ', '}
                {order.pickup_apartment && `Квартира ${order.pickup_apartment}`}
              </p>
            )}
          </div>
          <div>
            <p className="text-gray-900"><strong className="text-gray-900">Куда:</strong> {formatAddressForOrder(order.delivery_address)}</p>
            {(order.delivery_entrance || order.delivery_floor || order.delivery_apartment) && (
              <p className="text-sm text-gray-700 mt-1 ml-4">
                {order.delivery_entrance && `Подъезд ${order.delivery_entrance}`}
                {order.delivery_entrance && (order.delivery_floor || order.delivery_apartment) && ', '}
                {order.delivery_floor && `Этаж ${order.delivery_floor}`}
                {order.delivery_floor && order.delivery_apartment && ', '}
                {order.delivery_apartment && `Квартира ${order.delivery_apartment}`}
              </p>
            )}
            {order.sender_phone && (
              <p className="text-sm text-gray-700 mt-1 ml-4">
                <strong>Телефон отправителя:</strong>{' '}
                <a href={`tel:${order.sender_phone}`} className="text-brand-light hover:text-brand-light font-medium">
                  {order.sender_phone}
                </a>
              </p>
            )}
            {order.recipient_phone && (
              <p className="text-sm text-gray-700 mt-1 ml-4">
                <strong>Телефон получателя:</strong>{' '}
                <a href={`tel:${order.recipient_phone}`} className="text-brand-light hover:text-brand-light font-medium">
                  {order.recipient_phone}
                </a>
              </p>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-2 text-gray-900">Информация о заказе</h2>
          <p className="text-gray-900"><strong className="text-gray-900">Тип груза:</strong> {
            order.item_type === 'documents' ? 'Документы' :
            order.item_type === 'parcel' ? 'Посылка' :
            order.item_type === 'flowers' ? 'Цветы' :
            order.item_type === 'food' ? 'Еда' : 'Не указан'
          }</p>
          {order.description && (
            <p className="text-gray-900"><strong className="text-gray-900">Описание:</strong> {order.description}</p>
          )}
          {order.ready_at && (() => {
            const { formattedTime, timeStatus, statusType } = formatReadyTime(order.ready_at)
            return (
              <p className="text-gray-900 mt-2">
                <strong className="text-gray-900">Заказ будет готов к выдаче:</strong>{' '}
                <span className="text-gray-900">{formattedTime}</span>
                {timeStatus && (
                  <span className={`ml-2 ${statusType === 'waiting' ? 'text-red-400 animate-blink' : statusType === 'upcoming' ? 'text-yellow-400 animate-blink' : 'text-gray-600'}`}>
                    ({timeStatus})
                  </span>
                )}
              </p>
            )
          })()}
          <p className="text-xl font-bold mt-4 text-gray-900">Стоимость: {order.final_price} BYN</p>
          
          {/* Временные метки изменений статусов */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold mb-3 text-gray-900">История изменений статуса</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Время создания заказа</p>
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

              {order.accepted_at && (
                <div>
                  <p className="text-sm text-gray-600">Время принятия заказа</p>
                  <p className="text-gray-900">
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
                  <p className="text-sm text-gray-600">Время начала движения к отправителю</p>
                  <p className="text-gray-900">
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
                  <p className="text-sm text-gray-600">Время когда водитель забрал заказ</p>
                  <p className="text-gray-900">
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
                  <p className="text-sm text-gray-600">Время завершения заказа</p>
                  <p className="text-gray-900">
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
          <div className="mt-4 pt-4 border-t border-gray-200">
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
              className="flex-1 bg-blue-600 text-gray-900 px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {processing ? 'Обработка...' : 'Начать движение к отправителю'}
            </button>
          )}

          {canPickup && (
            <button
              onClick={handlePickup}
              disabled={processing}
              className="flex-1 bg-brand-light text-gray-900 px-6 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50"
            >
              {processing ? 'Обработка...' : 'Забрал заказ'}
            </button>
          )}

          {canComplete && (
            <button
              onClick={handleComplete}
              disabled={processing}
              className="flex-1 bg-brand-light text-gray-900 px-6 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50"
            >
              {processing ? 'Обработка...' : 'Завершить заказ'}
            </button>
          )}

          {order.status === 'completed' && (
            <div className="flex-1 bg-brand-light/20 border border-green-500 rounded p-4 text-center">
              <p className="text-brand-light font-semibold">Заказ завершен</p>
            </div>
          )}

          <button
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-white text-gray-900"
          >
            Назад
          </button>
        </div>
      </div>

      {/* Модальное окно оплаты */}
      {order && order.id && (
        <PaymentModal
          order={order}
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}
