'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DriverOrganizationChat } from './DriverOrganizationChat'

interface DriverOrganizationChatButtonProps {
  organizationId: string
  driverId?: string | null // null для общего чата, UUID для личного чата
  currentUserId: string
  currentUserRole: 'driver' | 'customer'
  className?: string
  showLabel?: boolean
}

export function DriverOrganizationChatButton({
  organizationId,
  driverId = null,
  currentUserId,
  currentUserRole,
  className = '',
  showLabel = true
}: DriverOrganizationChatButtonProps) {
  const [showChat, setShowChat] = useState(false)

  const chatType = driverId ? 'Личный чат' : 'Общий чат'

  return (
    <>
      <button
        onClick={() => setShowChat(true)}
        className={`flex items-center gap-2 ${
          driverId 
            ? 'bg-blue-600 hover:bg-blue-700' 
            : 'bg-yellow-200 hover:bg-yellow-300'
        } text-gray-900 px-4 py-2 rounded transition ${className}`}
        title={chatType}
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
        {showLabel && <span>{chatType}</span>}
      </button>

      {showChat && (
        <DriverOrganizationChat
          organizationId={organizationId}
          driverId={driverId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onClose={() => setShowChat(false)}
        />
      )}
    </>
  )
}

