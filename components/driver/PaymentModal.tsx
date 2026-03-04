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

  if (!order || !order.id) return null

  if (order.is_paid === true) return null

  const handlePayment = async (isPaid: boolean) => {
    setProcessing(true)
    setError(null)

    // Проверяем, что order.id является валидным UUID
    // UUID должен быть строкой длиной 36 символов в формате: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    
    // Строгая проверка: order.id должен существовать, быть строкой, не быть "0" или пустой строкой, и быть валидным UUID
    if (!order || !order.id) {
      setError('Ошибка: Заказ не найден. Пожалуйста, обновите страницу.')
      setProcessing(false)
      return
    }
    
    const orderIdStr = String(order.id).trim()
    
    // Проверяем, что это не "0" или пустая строка
    if (orderIdStr === '0' || orderIdStr === '' || orderIdStr === 'null' || orderIdStr === 'undefined') {
      setError('Ошибка: Неверный ID заказа. Пожалуйста, обновите страницу.')
      setProcessing(false)
      return
    }
    
    // Проверяем формат UUID
    if (!uuidRegex.test(orderIdStr)) {
      setError('Ошибка: Неверный формат ID заказа. Пожалуйста, обновите страницу.')
      setProcessing(false)
      return
    }

    try {
      // Финальная проверка перед вызовом RPC - убеждаемся, что это не "0"
      if (orderIdStr === '0' || orderIdStr.length !== 36) {
        setError('Ошибка: Неверный ID заказа. Пожалуйста, обновите страницу.')
        setProcessing(false)
        return
      }

      const { data, error: rpcError } = await supabase.rpc('process_order_payment', {
        order_uuid: orderIdStr,
        payment_status: isPaid,
      })

      if (rpcError) throw rpcError

      if (data === false) {
        throw new Error('Не удалось обработать оплату.')
      }

      // Проверяем баланс после обработки оплаты
      if (isPaid) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Увеличиваем задержку, чтобы дать время триггеру выполниться
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Проверяем баланс через обычный запрос
          await supabase
            .from('balances')
            .select('amount, currency, updated_at')
            .eq('user_id', user.id)
            .maybeSingle()
        }
      }

      // После успешной обработки оплаты вызываем onSuccess
      // onSuccess должен сам закрыть модальное окно и выполнить необходимые действия
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при обработке оплаты')
    } finally {
      setProcessing(false)
    }
  }

  const paidByText = (order.paid_by || 'sender') === 'sender' ? 'отправитель' : 'получатель'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Оплата заказа</h2>

        {/* Информация о заказе */}
        <div className="space-y-3 mb-6">
          <div>
            <p className="text-sm text-gray-600">Номер заказа</p>
            <p className="text-gray-900 font-semibold">
              {order.order_number ? `№${order.order_number}` : 'Без номера'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Сумма заказа</p>
            <p className="text-2xl font-bold text-brand-light">{order.final_price} BYN</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Оплачивает</p>
            <p className="text-gray-900 capitalize">{paidByText}</p>
          </div>

          {order.pickup_address && (
            <div>
              <p className="text-sm text-gray-600">Откуда</p>
              <p className="text-gray-900 text-sm">{order.pickup_address}</p>
            </div>
          )}

          {order.delivery_address && (
            <div>
              <p className="text-sm text-gray-600">Куда</p>
              <p className="text-gray-900 text-sm">{order.delivery_address}</p>
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
            className="flex-1 bg-green-300 hover:bg-green-400 text-gray-900 font-semibold py-3 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Обработка...' : 'Принял оплату'}
          </button>

          <button
            onClick={() => handlePayment(false)}
            disabled={processing}
            className="flex-1 bg-red-300 hover:bg-red-400 text-gray-900 font-semibold py-3 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Обработка...' : 'Заказ не оплачен'}
          </button>
        </div>

        <button
          onClick={onClose}
          disabled={processing}
          className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 text-gray-900 transition disabled:opacity-50"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

