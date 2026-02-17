'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OrderChat } from '@/components/chat/OrderChat'
import { useOrderUnreadMessagesCount } from '@/hooks/useOrderUnreadMessagesCount'

interface DriverClientChatsSectionProps {
  driverUserId: string
  activeOrders: any[]
}

export function DriverClientChatsSection({ driverUserId, activeOrders }: DriverClientChatsSectionProps) {
  const [openChatOrderId, setOpenChatOrderId] = useState<string | null>(null)

  if (!activeOrders || activeOrders.length === 0) {
    return null
  }

  return (
    <>
      <div className="bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Чаты с заказчиками</h2>
        <div className="space-y-3">
          {activeOrders.map((order) => (
            <OrderChatItem
              key={order.id}
              order={order}
              driverUserId={driverUserId}
              onOpenChat={() => setOpenChatOrderId(order.id)}
            />
          ))}
        </div>
      </div>

      {/* Модальное окно чата */}
      {openChatOrderId && (
        <OrderChat
          orderId={openChatOrderId}
          currentUserId={driverUserId}
          onClose={() => setOpenChatOrderId(null)}
        />
      )}
    </>
  )
}

interface OrderChatItemProps {
  order: any
  driverUserId: string
  onOpenChat: () => void
}

function OrderChatItem({ order, driverUserId, onOpenChat }: OrderChatItemProps) {
  const { count: unreadCount } = useOrderUnreadMessagesCount(order.id, driverUserId)

  return (
    <button
      onClick={onOpenChat}
      className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg p-4 transition text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium truncate">
              Заказ №{order.order_number || order.id.slice(0, 8)}
            </h3>
            <p className="text-sm text-gray-400 truncate">
              {order.client_id ? 'Чат с клиентом' : 'Чат с организацией'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <span className={`bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center ${
            unreadCount > 9 ? 'px-2 min-w-[1.5rem]' : 'w-6 h-6'
          }`}>
            {unreadCount > 10 ? unreadCount : unreadCount >= 10 ? 10 : unreadCount}
          </span>
        )}
        <svg className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

