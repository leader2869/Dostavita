'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'
import { BackButton } from '@/components/ui/BackButton'
import { OrderActions } from '@/components/driver/OrderActions'
import { PaymentModal } from '@/components/driver/PaymentModal'
import { DriverBottomNavigation } from '@/components/driver/DriverBottomNavigation'
import { OrderStatusProgress } from '@/components/orders/OrderStatusProgress'
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
  const [swipeProgress, setSwipeProgress] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeStartX, setSwipeStartX] = useState(0)
  const sliderRef = useRef<HTMLDivElement>(null)
  const nextActionRef = useRef<(() => Promise<void>) | null>(null)

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

  const handleStartComing = useCallback(async () => {
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
  }, [orderId, supabase, loadOrder])

  const handlePickup = useCallback(async () => {
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
  }, [orderId, supabase, loadOrder, order])

  const handleComplete = useCallback(async () => {
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
  }, [orderId, supabase, router, loadOrder, order])

  // Обновляем ref с текущим действием (должно быть до условных возвратов!)
  useEffect(() => {
    if (order?.status === 'courier_accepted') {
      nextActionRef.current = handleStartComing
    } else if (order?.status === 'courier_coming') {
      nextActionRef.current = handlePickup
    } else if (order?.status === 'courier_delivering') {
      nextActionRef.current = handleComplete
    } else {
      nextActionRef.current = null
    }
  }, [order?.status, handleStartComing, handlePickup, handleComplete])

  const getNextStatusLabel = useCallback(() => {
    if (order?.status === 'courier_accepted') return 'Начать движение к отправителю'
    if (order?.status === 'courier_coming') return 'Забрал заказ'
    if (order?.status === 'courier_delivering') return 'Завершить заказ'
    return ''
  }, [order?.status])

  const canStartComing = order?.status === 'courier_accepted'
  const canPickup = order?.status === 'courier_coming'
  const canComplete = order?.status === 'courier_delivering'
  const hasNextStatus = canStartComing || canPickup || canComplete

  // Обработчики свайпа
  const handleSwipeStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!hasNextStatus || processing) return
    e.preventDefault()
    setIsSwiping(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect()
      setSwipeStartX(clientX - rect.left)
    }
    setSwipeProgress(0)
  }, [hasNextStatus, processing])

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping || !hasNextStatus || processing || !sliderRef.current) return
    e.preventDefault()
    const clientX = e.touches[0].clientX
    const rect = sliderRef.current.getBoundingClientRect()
    const currentX = clientX - rect.left
    const sliderWidth = sliderRef.current.offsetWidth
    const diff = currentX - swipeStartX
    const progress = Math.min(Math.max((diff / sliderWidth) * 100, 0), 100)
    setSwipeProgress(progress)
  }, [isSwiping, hasNextStatus, processing, swipeStartX])

  const handleSwipeEnd = useCallback(async () => {
    if (!isSwiping || !hasNextStatus || processing) return
    
    const finalProgress = swipeProgress
    setIsSwiping(false)
    
    // Если свайпнули больше чем на 80%, выполняем действие
    if (finalProgress >= 80 && nextActionRef.current) {
      await nextActionRef.current()
    }
    
    setSwipeProgress(0)
  }, [isSwiping, hasNextStatus, processing, swipeProgress])

  // Глобальные обработчики для мыши
  useEffect(() => {
    if (!isSwiping || !sliderRef.current || !hasNextStatus) return

    let currentProgress = swipeProgress

    const handleMouseMove = (e: MouseEvent) => {
      if (processing || !sliderRef.current) return
      const rect = sliderRef.current.getBoundingClientRect()
      const currentX = e.clientX - rect.left
      const sliderWidth = sliderRef.current.offsetWidth
      const diff = currentX - swipeStartX
      const progress = Math.min(Math.max((diff / sliderWidth) * 100, 0), 100)
      currentProgress = progress
      setSwipeProgress(progress)
    }

    const handleMouseUp = async () => {
      if (processing) return
      setIsSwiping(false)
      
      if (currentProgress >= 80 && nextActionRef.current) {
        await nextActionRef.current()
      }
      
      setSwipeProgress(0)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isSwiping, swipeStartX, swipeProgress, hasNextStatus, processing])

  const handlePaymentSuccess = async () => {
    console.log('=== handlePaymentSuccess called ===')
    // Закрываем модальное окно
    setShowPaymentModal(false)
    
    // Небольшая задержка для обновления данных в базе
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Перезагружаем заказ, чтобы получить обновленный is_paid
    await loadOrder()
    console.log('Order reloaded after payment')
    
    // После успешной обработки оплаты переходим на главную страницу
    router.push('/dashboard/driver')
  }

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>
  }

  if (!order) {
    return <div className="text-center py-8 text-red-600">Заказ не найден</div>
  }

  return (
    <div className="max-w-2xl mx-auto pb-24 relative">
      {/* Кнопки действий - справа поверх контента */}
      {order && (
        <div className="fixed top-20 right-4 z-50">
          <OrderActions order={order} vertical={true} />
        </div>
      )}

      <div className="bg-gray-50 rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="font-semibold mb-4 text-gray-900">Статус заказа</h2>
          <OrderStatusProgress status={order.status} variant="connected" />
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

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {/* Ползунок для смены статуса - закреплен внизу, выше навигации */}
        {hasNextStatus && (
          <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-40">
            <div className="max-w-2xl mx-auto">
              <p className="text-xs text-gray-600 mb-2 text-center">Смахните ползунок вправо для смены статуса</p>
              
              <div 
                ref={sliderRef}
                className="swipe-slider relative bg-gray-200 rounded-full h-16 cursor-grab active:cursor-grabbing select-none w-1/2 mx-auto"
                onTouchStart={handleSwipeStart}
                onTouchMove={handleSwipeMove}
                onTouchEnd={handleSwipeEnd}
                onMouseDown={handleSwipeStart}
              >
              {/* Фон прогресса */}
              <div 
                className="absolute left-0 top-0 h-full bg-brand-light rounded-full transition-all duration-200"
                style={{ width: `${swipeProgress}%` }}
              ></div>
              
              {/* Ползунок */}
              <div 
                className="absolute left-0 top-0 h-full w-16 bg-white border-4 border-brand-light rounded-full flex items-center justify-center shadow-lg z-10"
                style={{ 
                  transform: `translateX(${Math.min(swipeProgress * (100 - 16) / 100, 100 - 16)}%)`,
                  transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
                }}
              >
                <svg className="w-6 h-6 text-brand-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
                
                {/* Текст */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-2">
                  <span className={`text-xs font-semibold transition-colors truncate ${swipeProgress >= 80 ? 'text-white' : 'text-gray-700'}`}>
                    {swipeProgress >= 80 ? 'Отпустите' : getNextStatusLabel()}
                  </span>
                </div>
              </div>
              
              {processing && (
                <p className="text-center text-xs text-gray-600 mt-2">Обработка...</p>
              )}
            </div>
          </div>
        )}

        {order.status === 'completed' && (
          <div className="pt-4 border-t border-gray-200">
            <div className="bg-green-50 border border-green-500 rounded-lg p-4 text-center">
              <p className="text-green-600 font-semibold text-lg">Заказ завершен</p>
            </div>
          </div>
        )}
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

      {/* Нижняя навигация */}
      <DriverBottomNavigation />
    </div>
  )
}
