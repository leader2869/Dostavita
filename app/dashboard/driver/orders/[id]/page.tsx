'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'
import { BackButton } from '@/components/ui/BackButton'

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
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (fetchError) throw fetchError
      setOrder(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orderId, supabase])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

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

      await loadOrder()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>
  }

  if (!order) {
    return <div className="text-center py-8 text-red-600">Заказ не найден</div>
  }

  const canPickup = order.status === 'courier_coming'
  const canComplete = order.status === 'courier_delivering'

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Детали заказа</h1>

      <div className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="font-semibold mb-2">Статус</h2>
          <p className="text-lg">
            {order.status === 'searching_courier' && 'Ищем курьера'}
            {order.status === 'courier_coming' && 'Курьер едет к вам'}
            {order.status === 'courier_delivering' && 'Курьер доставляет заказ'}
            {order.status === 'completed' && 'Заказ завершен'}
            {order.status === 'cancelled' && 'Отменен'}
          </p>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Адреса</h2>
          <p><strong>Откуда:</strong> {order.pickup_address}</p>
          <p><strong>Куда:</strong> {order.delivery_address}</p>
        </div>

        <div>
          <h2 className="font-semibold mb-2">Информация о заказе</h2>
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

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex gap-4 pt-4">
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
            <div className="flex-1 bg-green-50 border border-green-200 rounded p-4 text-center">
              <p className="text-green-800 font-semibold">Заказ завершен</p>
            </div>
          )}

          <button
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-600 rounded-md hover:bg-gray-900"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  )
}
