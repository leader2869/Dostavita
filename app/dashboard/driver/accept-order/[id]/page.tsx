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

      console.log('Accepting order:', { orderId, userId: user.id })
      
      const { data, error: rpcError } = await supabase.rpc('accept_order', {
        order_uuid: orderId,
        driver_user_uuid: user.id,
      })

      console.log('Accept order result:', { data, error: rpcError })

      if (rpcError) {
        console.error('RPC Error:', rpcError)
        throw rpcError
      }

      if (data === false) {
        throw new Error('Не удалось принять заказ. Убедитесь, что вы на линии и заказ доступен.')
      }

      // Проверяем, что заказ был обновлен
      const { data: updatedOrder, error: checkError } = await supabase
        .from('orders')
        .select('id, executor_user_id, status')
        .eq('id', orderId)
        .single()
      
      console.log('Order after accept:', { updatedOrder, checkError })

      router.push('/dashboard/driver')
    } catch (err: any) {
      setError(err.message)
      setAccepting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>
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
          <p><strong>Откуда:</strong> {order.pickup_address}</p>
          <p><strong>Куда:</strong> {order.delivery_address}</p>
          <p><strong>Тип груза:</strong> {
            order.item_type === 'documents' ? 'Документы' :
            order.item_type === 'parcel' ? 'Посылка' :
            order.item_type === 'flowers' ? 'Цветы' :
            order.item_type === 'food' ? 'Еда' : 'Не указан'
          }</p>
          {order.description && (
            <p><strong>Описание:</strong> {order.description}</p>
          )}
          <p className="text-xl font-bold mt-4">Стоимость: {order.final_price} BYN</p>
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

