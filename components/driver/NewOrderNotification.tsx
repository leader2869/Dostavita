'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'
import { AcceptOrderModal } from './AcceptOrderModal'

export function NewOrderNotification() {
  const supabase = createClient()
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [newOrder, setNewOrder] = useState<any>(null)
  const [hasActiveOrder, setHasActiveOrder] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [isDriver, setIsDriver] = useState(false)
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const shownOrderIdsRef = useRef<Set<string>>(new Set())
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Проверяем наличие активных заказов
  const checkActiveOrders = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('executor_user_id', userId)
        .in('status', ['courier_accepted', 'courier_coming', 'courier_delivering'])
        .limit(1)

      if (error) {
        console.error('Ошибка проверки активных заказов:', error)
        return false
      }

      return (data && data.length > 0) || false
    } catch (err) {
      console.error('Ошибка проверки активных заказов:', err)
      return false
    }
  }, [supabase])

  // Проверяем наличие новых доступных заказов
  const checkNewAvailableOrders = useCallback(async (userId: string) => {
    try {
      // Проверяем, есть ли активные заказы
      const hasActive = await checkActiveOrders(userId)
      setHasActiveOrder(hasActive)

      // Если есть активный заказ, не показываем модальное окно
      if (hasActive) {
        return
      }

      // Получаем отказы водителя
      const { data: rejections } = await supabase
        .from('order_rejections')
        .select('order_id')
        .eq('driver_user_id', userId)

      const rejectedOrderIds = new Set(rejections?.map(r => r.order_id) || [])

      // Получаем доступные заказы
      const { data: availableOrders, error } = await supabase
        .from('orders')
        .select('id, order_number, pickup_address, delivery_address, final_price, item_type, description, created_at')
        .eq('status', 'searching_courier')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Ошибка проверки доступных заказов:', error)
        return
      }

      if (!availableOrders || availableOrders.length === 0) {
        return
      }

      // Фильтруем заказы, исключая те, от которых водитель отказался
      const filteredOrders = availableOrders.filter(order => !rejectedOrderIds.has(order.id))

      if (filteredOrders.length === 0) {
        return
      }

      const latestOrder = filteredOrders[0]

      // Проверяем, это новый заказ (не тот, который мы уже показывали)
      // И модальное окно не должно быть уже открыто
      if (!shownOrderIdsRef.current.has(latestOrder.id) && !showModal) {
        setNewOrder(latestOrder)
        setShowModal(true)
        shownOrderIdsRef.current.add(latestOrder.id)
      }
    } catch (err) {
      console.error('Ошибка проверки новых заказов:', err)
    }
  }, [supabase, checkActiveOrders])

  // Проверяем роль пользователя
  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsDriver(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        setIsDriver(profile?.role === 'driver')
      } catch (err) {
        console.error('Ошибка проверки роли:', err)
        setIsDriver(false)
      }
    }

    checkRole()
  }, [])

  // Основной цикл проверки
  useEffect(() => {
    if (!isDriver) return

    let isMounted = true

    const startChecking = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !isMounted) return

        // Первая проверка сразу
        await checkNewAvailableOrders(user.id)

        // Затем проверяем каждые 10 секунд
        checkIntervalRef.current = setInterval(async () => {
          if (!isMounted) return
          
          const { data: { user: currentUser } } = await supabase.auth.getUser()
          if (!currentUser) return

          await checkNewAvailableOrders(currentUser.id)
        }, 10000)
      } catch (err) {
        console.error('Ошибка инициализации проверки заказов:', err)
      }
    }

    startChecking()

    return () => {
      isMounted = false
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [isDriver, checkNewAvailableOrders])

  const handleAccept = () => {
    if (!newOrder || processing) return
    setShowModal(false)
    setShowAcceptModal(true)
  }

  const handleReject = async () => {
    if (!newOrder || processing) return

    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Отклоняем заказ
      const response = await fetch('/api/driver/reject-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: newOrder.id }),
      })

      if (response.ok) {
        setShowModal(false)
        setNewOrder(null)
        // Заказ уже в shownOrderIdsRef, поэтому не будет показан снова
      } else {
        const data = await response.json()
        alert(data.error || 'Ошибка при отклонении заказа')
      }
    } catch (err) {
      console.error('Ошибка при отклонении заказа:', err)
      alert('Ошибка при отклонении заказа')
    } finally {
      setProcessing(false)
    }
  }

  const handleClose = () => {
    setShowModal(false)
    // Заказ уже в shownOrderIdsRef, поэтому не будет показан снова
    // Просто очищаем состояние
    setNewOrder(null)
  }

  if (!showModal || !newOrder) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4" onClick={handleClose}>
        <div className="bg-gray-50 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          {/* Заголовок */}
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900">Новый доступный заказ</h3>
            <button
              onClick={handleClose}
              className="text-gray-600 hover:text-gray-900 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Информация о заказе */}
          <div className="p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-600">Номер заказа</p>
              <p className="text-lg font-semibold text-gray-900">
                Заказ №{newOrder.order_number || newOrder.id.slice(0, 8)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Откуда</p>
              <p className="text-gray-900">{formatAddressForOrder(newOrder.pickup_address)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Куда</p>
              <p className="text-gray-900">{formatAddressForOrder(newOrder.delivery_address)}</p>
            </div>

            {newOrder.item_type && (
              <div>
                <p className="text-sm text-gray-600">Тип груза</p>
                <p className="text-gray-900">
                  {newOrder.item_type === 'documents' ? 'Документы' :
                   newOrder.item_type === 'parcel' ? 'Посылка' :
                   newOrder.item_type === 'flowers' ? 'Цветы' :
                   newOrder.item_type === 'food' ? 'Еда' :
                   newOrder.item_type === 'other' ? 'Другое' : 'Не указан'}
                </p>
              </div>
            )}

            {newOrder.description && (
              <div>
                <p className="text-sm text-gray-600">Описание</p>
                <p className="text-gray-900 italic">{newOrder.description}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-600">Стоимость</p>
              <p className="text-2xl font-bold text-brand-light">{newOrder.final_price} BYN</p>
            </div>
          </div>

          {/* Кнопки */}
          <div className="p-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={handleAccept}
              disabled={processing}
              className="flex-1 bg-green-300 hover:bg-green-400 text-gray-900 px-4 py-3 rounded transition disabled:opacity-50"
            >
              Принять заказ
            </button>
            <button
              onClick={handleReject}
              disabled={processing}
              className="flex-1 bg-red-300 hover:bg-red-400 text-gray-900 px-4 py-3 rounded transition disabled:opacity-50"
            >
              Отказаться
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно подтверждения принятия заказа */}
      {showAcceptModal && newOrder && (
        <AcceptOrderModal
          orderId={newOrder.id}
          onClose={() => {
            setShowAcceptModal(false)
            setShowModal(false)
            setNewOrder(null)
          }}
          onSuccess={() => {
            setShowAcceptModal(false)
            setShowModal(false)
            setNewOrder(null)
          }}
        />
      )}
    </>
  )
}

