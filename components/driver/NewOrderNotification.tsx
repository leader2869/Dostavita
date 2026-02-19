'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AcceptOrderModal } from './AcceptOrderModal'

export function NewOrderNotification() {
  const supabase = createClient()
  const [newOrder, setNewOrder] = useState<any>(null)
  const [hasActiveOrder, setHasActiveOrder] = useState(false)
  const [isDriver, setIsDriver] = useState(false)
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const shownOrderIdsRef = useRef<Set<string>>(new Set())
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Загружаем показанные заказы из sessionStorage при монтировании
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('driver_shown_order_ids')
      if (stored) {
        const ids = JSON.parse(stored)
        shownOrderIdsRef.current = new Set(ids)
      }
    } catch (err) {
      console.error('Ошибка загрузки показанных заказов из sessionStorage:', err)
    }
  }, [])

  // Сохраняем показанные заказы в sessionStorage
  const saveShownOrderIds = useCallback(() => {
    try {
      const ids = Array.from(shownOrderIdsRef.current)
      sessionStorage.setItem('driver_shown_order_ids', JSON.stringify(ids))
    } catch (err) {
      console.error('Ошибка сохранения показанных заказов в sessionStorage:', err)
    }
  }, [])

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
      if (!shownOrderIdsRef.current.has(latestOrder.id) && !showAcceptModal) {
        setNewOrder(latestOrder)
        setShowAcceptModal(true)
        shownOrderIdsRef.current.add(latestOrder.id)
        saveShownOrderIds()
      }
    } catch (err) {
      console.error('Ошибка проверки новых заказов:', err)
    }
  }, [supabase, checkActiveOrders, saveShownOrderIds, showAcceptModal])

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

  // Подписка на изменения статуса заказа в реальном времени
  useEffect(() => {
    if (!newOrder || !showAcceptModal) return

    const channel = supabase
      .channel(`order-${newOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${newOrder.id}`,
        },
        (payload) => {
          const updatedOrder = payload.new as any
          // Если заказ принят другим водителем (статус изменился с searching_courier)
          if (updatedOrder.status !== 'searching_courier') {
            console.log('Заказ принят другим водителем, закрываем модальное окно')
            // Помечаем заказ как показанный
            shownOrderIdsRef.current.add(newOrder.id)
            saveShownOrderIds()
            setShowAcceptModal(false)
            setNewOrder(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [newOrder, showAcceptModal, supabase, saveShownOrderIds])

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

  // Проверяем статус заказа перед показом модального окна
  useEffect(() => {
    if (!newOrder || !showAcceptModal) return

    const checkOrderStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('status, executor_user_id')
          .eq('id', newOrder.id)
          .single()

        if (error) {
          console.error('Ошибка проверки статуса заказа:', error)
          return
        }

        // Если заказ уже принят (статус не searching_courier), закрываем модальное окно
        if (data && data.status !== 'searching_courier') {
          console.log('Заказ уже принят, закрываем модальное окно')
          shownOrderIdsRef.current.add(newOrder.id)
          saveShownOrderIds()
          setShowAcceptModal(false)
          setNewOrder(null)
        }
      } catch (err) {
        console.error('Ошибка проверки статуса заказа:', err)
      }
    }

    // Проверяем статус сразу при открытии модального окна
    checkOrderStatus()

    // И проверяем каждые 2 секунды, пока модальное окно открыто
    const statusCheckInterval = setInterval(checkOrderStatus, 2000)

    return () => {
      clearInterval(statusCheckInterval)
    }
  }, [newOrder, showAcceptModal, supabase, saveShownOrderIds])

  if (!showAcceptModal || !newOrder) return null

  return (
    <>
      {/* Модальное окно подтверждения принятия заказа */}
      {showAcceptModal && newOrder && (
        <AcceptOrderModal
          orderId={newOrder.id}
          onClose={() => {
            // Помечаем заказ как показанный при закрытии
            shownOrderIdsRef.current.add(newOrder.id)
            saveShownOrderIds()
            setShowAcceptModal(false)
            setNewOrder(null)
          }}
          onSuccess={() => {
            // Помечаем заказ как показанный при успешном принятии
            shownOrderIdsRef.current.add(newOrder.id)
            saveShownOrderIds()
            setShowAcceptModal(false)
            setNewOrder(null)
          }}
        />
      )}
    </>
  )
}

