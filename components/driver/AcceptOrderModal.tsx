'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, Driver } from '@/lib/types'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'

interface AcceptOrderModalProps {
  orderId: string
  onClose: () => void
  onSuccess?: () => void
}

export function AcceptOrderModal({ orderId, onClose, onSuccess }: AcceptOrderModalProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [order, setOrder] = useState<Order | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isReactivating, setIsReactivating] = useState(false)

  const loadData = useCallback(async () => {
    try {
      // Загружаем заказ
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderError) throw orderError
      setOrder(orderData)

      // Загружаем профиль водителя
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Не авторизован')

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError
      
      // Проверяем, что у водителя заполнена информация об автомобиле
      if (profileData && profileData.vehicle_type) {
        setDriver(profileData as any)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orderId, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAccept = async () => {
    if (!driver) {
      setError('Профиль водителя не найден. Сначала создайте профиль водителя.')
      return
    }

    setAccepting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Не авторизован')
      }

      // Проверяем статус заказа перед принятием
      const { data: orderCheck, error: orderCheckError } = await supabase
        .from('orders')
        .select('id, status, executor_user_id')
        .eq('id', orderId)
        .single()

      if (orderCheckError) {
        throw new Error('Не удалось проверить статус заказа')
      }

      // Если заказ уже принят другим водителем
      if (orderCheck?.executor_user_id && orderCheck.executor_user_id !== user.id) {
        throw new Error('Заказ уже принят другим водителем')
      }

      // Проверяем, что заказ имеет правильный статус для принятия
      if (orderCheck?.status !== 'searching_courier' && orderCheck?.status !== 'cancelled') {
        throw new Error(`Заказ не может быть принят. Текущий статус: ${orderCheck?.status}`)
      }

      // Если заказ отменен, сначала активируем его (меняем статус на searching_courier)
      if (order?.status === 'cancelled') {
        const { error: reactivateError } = await supabase
          .from('orders')
          .update({ 
            status: 'searching_courier',
            cancelled_at: null
          })
          .eq('id', orderId)
        
        if (reactivateError) throw reactivateError
      }

      const { data, error: rpcError } = await supabase.rpc('accept_order', {
        order_uuid: orderId,
        driver_user_uuid: user.id,
      })

      if (rpcError) {
        throw new Error(rpcError.message || 'Ошибка при принятии заказа')
      }

      if (data === false || data === null) {
        throw new Error('Не удалось принять заказ. Убедитесь, что заказ доступен и у вас заполнен профиль водителя (тип транспорта и номер водительского удостоверения).')
      }
      
      // После успешного принятия заказа перенаправляем на детали заказа
      if (onSuccess) {
        onSuccess()
      }
      // Используем полный редирект для гарантированного перехода
      // Модальное окно закроется автоматически при переходе на другую страницу
      window.location.href = `/dashboard/driver/orders/${orderId}`
    } catch (err: any) {
      const errorMessage = err.message || 'Не удалось принять заказ'
      setError(errorMessage)
      setAccepting(false)
      // Не делаем редирект при ошибке
    }
  }

  const handleReject = async () => {
    if (!order) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const response = await fetch('/api/driver/reject-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })

      if (response.ok) {
        onClose()
        if (onSuccess) {
          onSuccess()
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Ошибка при отклонении заказа')
      }
    } catch (err: any) {
      console.error('Ошибка при отклонении заказа:', err)
      setError(err.message || 'Ошибка при отклонении заказа')
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
        <div className="bg-gray-50 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <div className="p-6 text-center">
            <p className="text-gray-600">Загрузка...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
        <div className="bg-gray-50 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <div className="p-6 text-center">
            <p className="text-red-600">Заказ не найден</p>
            <button
              onClick={onClose}
              className="mt-4 bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-gray-50 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900 font-amatic-sc">Просто!Новый заказ</h3>
          <button
            onClick={onClose}
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
            <p className="text-gray-900 mb-2"><strong className="text-gray-900">Номер заказа:</strong> {order.order_number || order.id.slice(0, 8)}</p>
            <p className="text-gray-900"><strong className="text-gray-900">Откуда:</strong> {formatAddressForOrder(order.pickup_address)}</p>
            <p className="text-gray-900"><strong className="text-gray-900">Куда:</strong> {formatAddressForOrder(order.delivery_address)}</p>
            <p className="text-gray-900"><strong className="text-gray-900">Тип груза:</strong> {
              order.item_type === 'documents' ? 'Документы' :
              order.item_type === 'parcel' ? 'Посылка' :
              order.item_type === 'flowers' ? 'Цветы' :
              order.item_type === 'food' ? 'Еда' : 'Не указан'
            }</p>
            {order.description && (
              <p className="text-gray-900"><strong className="text-gray-900">Описание:</strong> {order.description}</p>
            )}
            <p className="text-xl font-bold mt-4 text-gray-900">Стоимость: {order.final_price} BYN</p>
          </div>

          {!driver && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-yellow-800 mb-2">
                Для принятия заказов необходимо создать профиль водителя.
              </p>
              <a
                href="/dashboard/driver/profile"
                className="text-brand-light hover:text-brand-dark underline"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose()
                }}
              >
                Создать профиль водителя
              </a>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-red-800 font-semibold text-sm mb-1">Ошибка</p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleAccept}
            disabled={accepting || !driver}
            className="flex-1 bg-green-300 hover:bg-green-400 text-gray-900 px-4 py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? 'Принятие...' : 'Принять заказ'}
          </button>
          <button
            onClick={handleReject}
            disabled={accepting || !driver}
            className="flex-1 bg-red-300 hover:bg-red-400 text-gray-900 px-4 py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Отказаться
          </button>
        </div>
      </div>
    </div>
  )
}


