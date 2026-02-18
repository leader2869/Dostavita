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

  console.log('=== PaymentModal render ===')
  console.log('isOpen:', isOpen)
  console.log('order:', order)
  console.log('order.id:', order?.id)
  console.log('order.id type:', typeof order?.id)
  console.log('order.is_paid:', order?.is_paid)
  console.log('Will show modal?', isOpen && (order?.is_paid === false || order?.is_paid === null))

  if (!isOpen) {
    console.log('❌ Modal not shown - isOpen is false')
    return null
  }
  
  // Проверяем, что order существует и имеет валидный id
  if (!order || !order.id) {
    console.error('❌ Modal not shown - order or order.id is missing')
    console.error('Order:', order)
    return null
  }
  
  // Не показываем модальное окно, если оплата уже обработана (is_paid === true)
  if (order.is_paid === true) {
    console.log('❌ Modal not shown - is_paid is already true (payment processed)')
    return null
  }
  
  console.log('✅ Modal will be shown')

  const handlePayment = async (isPaid: boolean) => {
    setProcessing(true)
    setError(null)

    console.log('=== Processing payment ===')
    console.log('Order ID:', order.id)
    console.log('Order ID type:', typeof order.id)
    console.log('isPaid (payment_status):', isPaid)
    console.log('Order final_price:', order.final_price)

    // Проверяем, что order.id является валидным UUID
    // UUID должен быть строкой длиной 36 символов в формате: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    
    // Строгая проверка: order.id должен существовать, быть строкой, не быть "0" или пустой строкой, и быть валидным UUID
    if (!order || !order.id) {
      console.error('❌ Order or order.id is missing')
      console.error('Order object:', order)
      setError('Ошибка: Заказ не найден. Пожалуйста, обновите страницу.')
      setProcessing(false)
      return
    }
    
    const orderIdStr = String(order.id).trim()
    
    // Проверяем, что это не "0" или пустая строка
    if (orderIdStr === '0' || orderIdStr === '' || orderIdStr === 'null' || orderIdStr === 'undefined') {
      console.error('❌ Invalid order ID (0, empty, null, or undefined):', orderIdStr)
      console.error('Order object:', order)
      console.error('Order ID type:', typeof order.id)
      setError('Ошибка: Неверный ID заказа. Пожалуйста, обновите страницу.')
      setProcessing(false)
      return
    }
    
    // Проверяем формат UUID
    if (!uuidRegex.test(orderIdStr)) {
      console.error('❌ Invalid UUID format:', orderIdStr)
      console.error('Order object:', order)
      console.error('Order ID type:', typeof order.id)
      console.error('Order ID length:', orderIdStr.length)
      setError(`Ошибка: Неверный формат ID заказа (${orderIdStr}). Пожалуйста, обновите страницу.`)
      setProcessing(false)
      return
    }

    try {
      // Финальная проверка перед вызовом RPC - убеждаемся, что это не "0"
      if (orderIdStr === '0' || orderIdStr.length !== 36) {
        console.error('❌ Final validation failed before RPC call')
        console.error('orderIdStr:', orderIdStr)
        console.error('orderIdStr length:', orderIdStr.length)
        console.error('orderIdStr === "0":', orderIdStr === '0')
        setError('Ошибка: Неверный ID заказа. Пожалуйста, обновите страницу.')
        setProcessing(false)
        return
      }
      
      console.log('Using order_uuid:', orderIdStr)
      console.log('Order UUID validation passed')
      console.log('Calling RPC with parameters:', {
        order_uuid: orderIdStr,
        payment_status: isPaid,
        order_uuid_type: typeof orderIdStr,
        order_uuid_length: orderIdStr.length
      })
      
      const { data, error: rpcError } = await supabase.rpc('process_order_payment', {
        order_uuid: orderIdStr,
        payment_status: isPaid,
      })

      console.log('RPC result:', { data, error: rpcError })

      if (rpcError) {
        console.error('RPC error:', rpcError)
        console.error('RPC error details:', JSON.stringify(rpcError, null, 2))
        throw rpcError
      }

      if (data === false) {
        console.error('Function returned false - payment processing failed')
        console.error('Possible reasons:')
        console.error('1. Миграция 087 не применена (вспомогательные функции не созданы)')
        console.error('2. Заказ уже обработан (is_paid = true)')
        console.error('3. Заказ не в правильном статусе (должен быть courier_delivering или completed)')
        console.error('4. Вспомогательные функции не могут обойти RLS')
        console.error('5. Заказ не принадлежит текущему водителю')
        
        // Проверяем статус заказа
        const { data: orderCheck } = await supabase
          .from('orders')
          .select('id, status, is_paid, executor_user_id')
          .eq('id', order.id)
          .single()
        
        console.error('Order check:', orderCheck)
        
        throw new Error('Не удалось обработать оплату. Проверьте логи в консоли для деталей.')
      }

      console.log('✅ Payment processed successfully, isPaid:', isPaid)

      // Проверяем баланс после обработки оплаты
      if (isPaid) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Увеличиваем задержку, чтобы дать время триггеру выполниться
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Проверяем баланс через обычный запрос
          const { data: balanceData, error: balanceError } = await supabase
            .from('balances')
            .select('amount, currency, updated_at')
            .eq('user_id', user.id)
            .maybeSingle()
          
          console.log('=== Balance check after payment ===')
          console.log('User ID:', user.id)
          console.log('Balance data:', balanceData)
          console.log('Balance error:', balanceError)
          console.log('Balance amount:', balanceData?.amount)
          
          // Если баланс не найден, проверяем через прямой запрос к базе
          if (!balanceData && !balanceError) {
            console.warn('⚠️ Баланс не найден после обработки оплаты!')
            console.warn('Это может означать, что:')
            console.warn('1. Миграция 085 не применена')
            console.warn('2. RLS все еще блокирует создание баланса')
            console.warn('3. Функция process_order_payment не смогла создать баланс')
          }
          
          // Проверяем транзакции
          const { data: transactionsData, error: transactionsError } = await supabase
            .from('transactions')
            .select('*')
            .eq('order_id', order.id)
            .order('created_at', { ascending: false })
            .limit(5)
          
          console.log('=== Transaction check after payment ===')
          console.log('Transactions data:', transactionsData)
          console.log('Transactions count:', transactionsData?.length || 0)
          console.log('Transactions error:', transactionsError)
          
          if (!transactionsData || transactionsData.length === 0) {
            console.warn('⚠️ Транзакции не найдены после обработки оплаты!')
            console.warn('Это может означать, что функция не создала транзакцию')
          }
          
          // Проверяем, обновился ли заказ
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('is_paid, final_price')
            .eq('id', order.id)
            .single()
          
          console.log('=== Order check after payment ===')
          console.log('Order is_paid:', orderData?.is_paid)
          console.log('Order final_price:', orderData?.final_price)
          console.log('Order error:', orderError)
        }
      }

      // После успешной обработки оплаты перезагружаем заказ
      onSuccess()
      
      // Если заказ еще не завершен, можно попробовать завершить его автоматически
      // Но лучше оставить это пользователю
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
            className="flex-1 bg-brand-light hover:bg-brand-dark text-gray-900 font-semibold py-3 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Обработка...' : 'Принял оплату'}
          </button>

          <button
            onClick={() => handlePayment(false)}
            disabled={processing}
            className="flex-1 bg-red-600 hover:bg-red-700 text-gray-900 font-semibold py-3 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
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

