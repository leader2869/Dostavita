'use client'

import { SignOutButton } from '@/components/auth/SignOutButton'
import { ChatNotifications } from '@/components/notifications/ChatNotifications'
import type { User } from '@/lib/types'

interface DashboardNavProps {
  profile: User
  userId: string
}

export function DashboardNav({ profile, userId }: DashboardNavProps) {
  return (
    <div className="flex items-center space-x-4">
      {/* Уведомления о сообщениях */}
      <ChatNotifications userId={userId} userRole={profile.role} />
      
      <div className="flex items-center space-x-3">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url || ''}
            alt="Аватар"
            className="w-8 h-8 rounded-full object-cover border border-gray-600"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        <span className="text-sm text-gray-300">
          {profile.full_name || profile.email}
        </span>
      </div>
      <SignOutButton />
    </div>
  )
}

