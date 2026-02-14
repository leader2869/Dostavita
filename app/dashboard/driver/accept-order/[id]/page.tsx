'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, Driver } from '@/lib/types'
import { BackButton } from '@/components/ui/BackButton'

export default function AcceptOrderPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const supabase = createClient()
  
  const [order, setOrder] = useState<Order | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      if (profileData && profileData.vehicle_type && profileData.license_number) {
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
      if (!user) throw new Error('Не авторизован')

      console.log('=== Accepting order ===')
      console.log('Order ID:', orderId)
      console.log('User ID:', user.id)
      
      // Сначала проверяем заказ до принятия
      const { data: orderBefore, error: orderBeforeError } = await supabase
        .from('orders')
        .select('id, status, executor_user_id')
        .eq('id', orderId)
        .single()
      
      console.log('Order BEFORE accept:', { orderBefore, orderBeforeError })
      
      const { data, error: rpcError } = await supabase.rpc('accept_order', {
        order_uuid: orderId,
        driver_user_uuid: user.id,
      })

      console.log('Accept order RPC result:')
      console.log('  - Success:', data)
      console.log('  - Error:', rpcError)
      if (rpcError) {
        console.error('RPC Error details:', JSON.stringify(rpcError, null, 2))
      }

      if (rpcError) {
        console.error('RPC Error:', rpcError)
        throw rpcError
      }

      if (data === false || data === null) {
        console.error('Function returned false/null - order was not accepted')
        console.error('Possible reasons:')
        console.error('  1. Order status is not searching_courier')
        console.error('  2. Driver profile missing vehicle_type or license_number')
        console.error('  3. Function accept_order not found or wrong signature')
        throw new Error('Не удалось принять заказ. Убедитесь, что заказ доступен и у вас заполнен профиль водителя (тип транспорта и номер водительского удостоверения).')
      }
      
      console.log('✅ Function returned:', data)
      console.log('✅ Order should be accepted now')

      // Проверяем, что заказ был обновлен
      // Используем RPC функцию для обхода RLS, если обычный запрос не работает
      console.log('Проверяем заказ после принятия...')
      const { data: updatedOrder, error: checkError } = await supabase
        .from('orders')
        .select('id, executor_user_id, status, accepted_at')
        .eq('id', orderId)
        .eq('executor_user_id', user.id) // Добавляем фильтр по executor_user_id для RLS
        .single()
      
      // Если не получилось через обычный запрос, пробуем через RPC
      if (checkError && checkError.code === 'PGRST116') {
        console.log('Обычный запрос не сработал, пробуем через RPC...')
        const { data: orderViaRpc, error: rpcCheckError } = await supabase.rpc('get_order_by_id', {
          order_id: orderId
        })
        if (!rpcCheckError && orderViaRpc) {
          console.log('Заказ получен через RPC:', orderViaRpc)
        }
      }
      
      console.log('=== Order AFTER accept ===')
      console.log('Updated order:', updatedOrder)
      console.log('Check error:', checkError)
      if (updatedOrder) {
        console.log('executor_user_id:', updatedOrder.executor_user_id)
        console.log('status:', updatedOrder.status)
        console.log('Matches user ID?', updatedOrder.executor_user_id === user.id)
        console.log('Expected status: courier_coming')
        console.log('Actual status:', updatedOrder.status)
        if (updatedOrder.status !== 'courier_coming') {
          console.error('⚠️ ПРОБЛЕМА: Статус не изменился на courier_coming!')
          console.error('Возможно, миграция 025 не применена или функция работает неправильно')
        }
        if (updatedOrder.executor_user_id !== user.id) {
          console.error('⚠️ ПРОБЛЕМА: executor_user_id не установлен!')
        }
      } else {
        console.error('❌ Заказ не найден после принятия!')
      }

      // Переходим на страницу "Мои заказы" после принятия заказа
      // Используем router.push вместо window.location.href, чтобы сохранить логи в консоли
      console.log('✅ Заказ принят успешно, переходим на страницу "Мои заказы"')
      router.push('/dashboard/driver/my-orders')
    } catch (err: any) {
      console.error('❌ ОШИБКА при принятии заказа:', err)
      console.error('Error message:', err.message)
      console.error('Error details:', JSON.stringify(err, null, 2))
      if (err.stack) {
        console.error('Error stack:', err.stack)
      }
      setError(err.message || 'Не удалось принять заказ')
      setAccepting(false)
      // НЕ делаем редирект при ошибке, чтобы пользователь мог увидеть ошибку
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-white">Загрузка...</div>
  }

  if (!order) {
    return <div className="text-center py-8 text-red-600">Заказ не найден</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Принять заказ</h1>

      <div className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="font-semibold mb-2 text-white">Детали заказа</h2>
          <p className="text-white"><strong className="text-white">Откуда:</strong> {order.pickup_address}</p>
          <p className="text-white"><strong className="text-white">Куда:</strong> {order.delivery_address}</p>
          <p className="text-white"><strong className="text-white">Тип груза:</strong> {
            order.item_type === 'documents' ? 'Документы' :
            order.item_type === 'parcel' ? 'Посылка' :
            order.item_type === 'flowers' ? 'Цветы' :
            order.item_type === 'food' ? 'Еда' : 'Не указан'
          }</p>
          {order.description && (
            <p className="text-white"><strong className="text-white">Описание:</strong> {order.description}</p>
          )}
          <p className="text-xl font-bold mt-4 text-white">Стоимость: {order.final_price} BYN</p>
        </div>

        {!driver && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-yellow-800">
              Для принятия заказов необходимо создать профиль водителя.
            </p>
            <a
              href="/dashboard/driver/profile"
              className="text-green-500 hover:text-green-600 underline"
            >
              Создать профиль водителя
            </a>
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleAccept}
            disabled={accepting || !driver}
            className="flex-1 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {accepting ? 'Принятие...' : 'Принять заказ'}
          </button>
          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/driver/reject-order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: order.id }),
                })
                const data = await response.json()
                if (response.ok) {
                  router.push('/dashboard/driver')
                } else {
                  setError(data.error || 'Ошибка при отклонении заказа')
                }
              } catch (err: any) {
                setError(err.message || 'Ошибка при отклонении заказа')
              }
            }}
            disabled={accepting || !driver}
            className="flex-1 bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Отказаться
          </button>
        </div>
      </div>
    </div>
  )
}

