'use client'

import { useOrderUnreadMessagesCount } from '@/hooks/useOrderUnreadMessagesCount'
import { OrderChat } from '@/components/chat/OrderChat'
import { useState } from 'react'

interface OrderChatBadgeProps {
  orderId: string
  userId: string
  className?: string
}

export function OrderChatBadge({ orderId, userId, className = '' }: OrderChatBadgeProps) {
  const { count } = useOrderUnreadMessagesCount(orderId, userId)
  const [showChat, setShowChat] = useState(false)

  // Не показываем иконку, если нет непрочитанных сообщений
  if (count === 0) {
    return null
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowChat(true)
        }}
        className={`relative p-2 text-gray-600 hover:text-blue-500 transition-colors ${className}`}
        title={`Непрочитанных сообщений: ${count}`}
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
        <span className={`absolute -top-1 -right-1 bg-red-500 text-gray-900 text-xs font-bold rounded-full flex items-center justify-center ${
          count > 9 ? 'px-1.5 min-w-[1.5rem]' : 'w-5 h-5'
        }`}>
          {count > 10 ? count : count >= 10 ? 10 : count}
        </span>
      </button>

      {showChat && (
        <OrderChat
          orderId={orderId}
          currentUserId={userId}
          onClose={() => setShowChat(false)}
        />
      )}
    </>
  )
}

