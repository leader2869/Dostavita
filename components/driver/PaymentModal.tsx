'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/lib/types'

interface PaymentModalProps {
  order: Order
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PaymentModal({ order, isOpen, onClose, onSuccess }: PaymentModalProps) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  if (!isOpen) return null

  const handlePayment = async (isPaid: boolean) => {
    setProcessing(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('process_order_payment', {
        order_uuid: order.id,
        is_paid: isPaid,
      })

      if (rpcError) throw rpcError

      if (data === false) {
        throw new Error('Не удалось обработать оплату')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при обработке оплаты')
    } finally {
      setProcessing(false)
    }
  }

  const paidByText = (order.paid_by || 'sender') === 'sender' ? 'отправитель' : 'получатель'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Оплата заказа</h2>

        {/* Информация о заказе */}
        <div className="space-y-3 mb-6">
          <div>
            <p className="text-sm text-gray-400">Номер заказа</p>
            <p className="text-white font-semibold">
              {order.order_number ? `№${order.order_number}` : 'Без номера'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-400">Сумма заказа</p>
            <p className="text-2xl font-bold text-green-400">{order.final_price} BYN</p>
          </div>

          <div>
            <p className="text-sm text-gray-400">Оплачивает</p>
            <p className="text-white capitalize">{paidByText}</p>
          </div>

          {order.pickup_address && (
            <div>
              <p className="text-sm text-gray-400">Откуда</p>
              <p className="text-white text-sm">{order.pickup_address}</p>
            </div>
          )}

          {order.delivery_address && (
            <div>
              <p className="text-sm text-gray-400">Куда</p>
              <p className="text-white text-sm">{order.delivery_address}</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-3">
          <button
            onClick={() => handlePayment(true)}
            disabled={processing}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Обработка...' : 'Принял оплату'}
          </button>

          <button
            onClick={() => handlePayment(false)}
            disabled={processing}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Обработка...' : 'Заказ не оплачен'}
          </button>
        </div>

        <button
          onClick={onClose}
          disabled={processing}
          className="mt-4 w-full px-4 py-2 border border-gray-600 rounded-md hover:bg-gray-700 text-white transition disabled:opacity-50"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

