'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { ChatNotifications } from '@/components/notifications/ChatNotifications'
import type { User } from '@/lib/types'

interface DashboardNavProps {
  profile: User
  userId: string
}

export function DashboardNav({ profile: initialProfile, userId }: DashboardNavProps) {
  const supabase = createClient()
  const [profile, setProfile] = useState<User>(initialProfile)
  const [avatarKey, setAvatarKey] = useState(Date.now())

  // Загружаем актуальный профиль и слушаем изменения
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (!error && data) {
          // Обновляем ключ только если avatar_url действительно изменился
          setProfile(prevProfile => {
            if (prevProfile.avatar_url !== data.avatar_url) {
              setAvatarKey(Date.now())
            }
            return data as User
          })
        }
      } catch (err) {
        console.error('Ошибка загрузки профиля:', err)
      }
    }

    // Загружаем профиль сразу
    loadProfile()

    // Подписываемся на изменения профиля через Realtime
    const channel = supabase
      .channel(`profile_changes_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const updatedProfile = payload.new as User
          // Обновляем профиль и ключ только если avatar_url изменился
          setProfile(prevProfile => {
            if (prevProfile.avatar_url !== updatedProfile.avatar_url) {
              setAvatarKey(Date.now())
            }
            return updatedProfile
          })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userId, supabase])

  return (
    <div className="flex items-center space-x-4">
      {/* Уведомления о сообщениях */}
      <ChatNotifications userId={userId} userRole={profile.role} />
      
      <div className="flex items-center space-x-3">
        {profile.avatar_url ? (
          <img
            key={avatarKey}
            src={`${profile.avatar_url}?t=${avatarKey}`}
            alt="Аватар"
            className="w-8 h-8 rounded-full object-cover border border-gray-300"
            onError={(e) => {
              // Если изображение не загрузилось, скрываем его и показываем иконку
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        <span className="text-sm text-gray-900">
          {profile.full_name || profile.email}
        </span>
      </div>
      <SignOutButton />
    </div>
  )
}

