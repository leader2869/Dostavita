'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OrderChat } from '@/components/chat/OrderChat'
import { useOrderUnreadMessagesCount } from '@/hooks/useOrderUnreadMessagesCount'
import { ShareOrderModal } from '@/components/orders/ShareOrderModal'

interface ClientOrderActionsProps {
  order: {
    id: string
    executor_user_id: string | null
    status: string
    order_number?: number | null
    pickup_address?: string
    delivery_address?: string
    sender_phone?: string | null
    recipient_phone?: string | null
    final_price?: number
    item_type?: string | null
    description?: string | null
    ready_at?: string | null
    created_at?: string
  }
  userId: string
}

export function ClientOrderActions({ order, userId }: ClientOrderActionsProps) {
  const supabase = createClient()
  const [driverPhone, setDriverPhone] = useState<string | null>(null)
  const [loadingPhone, setLoadingPhone] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const { count: unreadCount } = useOrderUnreadMessagesCount(order.id, userId)

  // Загружаем телефон водителя, если заказ принят
  useEffect(() => {
    if (!order.executor_user_id) {
      return
    }

    let isMounted = true

    const loadDriverPhone = async () => {
      try {
        setLoadingPhone(true)
        const { data: driver } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', order.executor_user_id)
          .single()

        if (isMounted && driver) {
          setDriverPhone(driver.phone)
        }
      } catch (err) {
        console.error('Ошибка загрузки телефона водителя:', err)
      } finally {
        if (isMounted) {
          setLoadingPhone(false)
        }
      }
    }

    loadDriverPhone()

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.executor_user_id])

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (driverPhone) {
      window.location.href = `tel:${driverPhone}`
    }
  }

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowChat(true)
  }

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowShareModal(true)
  }

  // Показываем компонент только для активных заказов
  if (order.status === 'completed' || order.status === 'cancelled') {
    return null
  }

  return (
    <>
      <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
        {/* Кнопка телефона - только если заказ принят водителем */}
        {order.executor_user_id && (
          <button
            onClick={handlePhoneClick}
            disabled={!driverPhone || loadingPhone}
            className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={driverPhone ? `Позвонить водителю: ${driverPhone}` : 'Телефон водителя не указан'}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span className="text-sm">Позвонить</span>
          </button>
        )}

        {/* Кнопка сообщения - только если заказ принят водителем */}
        {order.executor_user_id && (
          <button
            onClick={handleChatClick}
            className="relative flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 px-4 py-2 rounded transition"
            title="Открыть чат"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="text-sm">Сообщение</span>
            {unreadCount > 0 && (
              <span className={`absolute -top-1 -right-1 bg-red-500 text-gray-900 text-xs font-bold rounded-full flex items-center justify-center ${
                unreadCount > 9 ? 'px-1.5 min-w-[1.5rem]' : 'w-5 h-5'
              }`}>
                {unreadCount > 10 ? unreadCount : unreadCount >= 10 ? 10 : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Кнопка поделиться - для всех активных заказов */}
        <button
          onClick={handleShareClick}
          className="flex items-center justify-center bg-brand-light hover:bg-brand-dark text-gray-900 px-4 py-2 rounded transition"
          title="Поделиться заказом"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        </button>
      </div>

      {/* Чат */}
      {showChat && (
        <OrderChat
          orderId={order.id}
          currentUserId={userId}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Модальное окно для шаринга заказа */}
      {showShareModal && (
        <ShareOrderModal
          order={order}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  )
}

