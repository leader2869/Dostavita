'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DriverOrganizationChat } from '@/components/chat/DriverOrganizationChat'

interface DriverChatSectionProps {
  driverUserId: string
  organizationId: string | null
}

export function DriverChatSection({ driverUserId, organizationId }: DriverChatSectionProps) {
  const supabase = createClient()
  const [activeChat, setActiveChat] = useState<'general' | 'personal' | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  // Функция для загрузки счетчика непрочитанных сообщений
  const loadUnreadCount = useCallback(async () => {
    if (!organizationId) {
      setUnreadCount(0)
      return
    }

    try {
      // Подсчитываем непрочитанные сообщения в общем чате
      const { count: generalUnread, error: generalError } = await supabase
        .from('driver_organization_messages')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('driver_id', null)
        .neq('sender_id', driverUserId)
        .is('read_at', null)

      if (generalError) {
        console.error('Ошибка подсчета непрочитанных в общем чате:', generalError)
      }

      // Подсчитываем непрочитанные сообщения в личном чате
      const { count: personalUnread, error: personalError } = await supabase
        .from('driver_organization_messages')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('driver_id', driverUserId)
        .neq('sender_id', driverUserId)
        .is('read_at', null)

      if (personalError) {
        console.error('Ошибка подсчета непрочитанных в личном чате:', personalError)
      }

      const total = (generalUnread || 0) + (personalUnread || 0)
      console.log('Непрочитанные сообщения - общий:', generalUnread, 'личный:', personalUnread, 'всего:', total)
      setUnreadCount(total)
    } catch (err) {
      console.error('Ошибка подсчета непрочитанных сообщений:', err)
    }
  }, [organizationId, driverUserId, supabase])

  useEffect(() => {
    if (!organizationId) {
      setUnreadCount(0)
      return
    }

    let isMounted = true

    loadUnreadCount()

    // Подписываемся на изменения сообщений (включая обновления read_at)
    const channel = supabase
      .channel(`driver_chat_unread_${driverUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_organization_messages',
          filter: `organization_id=eq.${organizationId}`
        },
        () => {
          // Небольшая задержка, чтобы дать время базе данных обновиться
          setTimeout(() => {
            if (isMounted) {
              loadUnreadCount()
            }
          }, 500)
        }
      )
      .subscribe()

    // Обновляем каждые 5 секунд для более быстрого обновления
    const interval = setInterval(() => {
      if (isMounted) {
        loadUnreadCount()
      }
    }, 5000)

    return () => {
      isMounted = false
      channel.unsubscribe()
      clearInterval(interval)
    }
  }, [driverUserId, organizationId, loadUnreadCount])

  return (
    <>
      <div className="bg-gray-50 rounded-lg shadow p-6">
        {!organizationId && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded text-yellow-200 text-sm">
            Вы не привязаны к организации. Чаты будут доступны после привязки к организации.
          </div>
        )}
        {organizationId && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Чаты с организацией</h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-gray-900 text-xs font-bold rounded-full px-2 py-1">
                  {unreadCount > 9 ? '9+' : unreadCount} непрочитанных
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Общий чат компании */}
              <button
                onClick={() => setActiveChat('general')}
                className="bg-gray-100 hover:bg-gray-100 rounded-lg p-4 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">Общий чат компании</h3>
                    <p className="text-sm text-gray-600">Чат для всех водителей организации</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Личный чат с организацией */}
              <button
                onClick={() => setActiveChat('personal')}
                className="bg-gray-100 hover:bg-gray-100 rounded-lg p-4 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">Личный чат</h3>
                    <p className="text-sm text-gray-600">Приватный чат с организацией</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Модальное окно чата */}
      {activeChat && organizationId && (
        <DriverOrganizationChat
          organizationId={organizationId as string}
          driverId={activeChat === 'general' ? null : driverUserId}
          currentUserId={driverUserId}
          currentUserRole="driver"
          onClose={() => {
            setActiveChat(null)
            // Обновляем счетчик непрочитанных сообщений после закрытия чата
            // Увеличиваем задержку, чтобы дать время базе данных обновиться
            setTimeout(() => {
              const loadUnreadCount = async () => {
                try {
                  const { count: generalUnread } = await supabase
                    .from('driver_organization_messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('organization_id', organizationId)
                    .is('driver_id', null)
                    .neq('sender_id', driverUserId)
                    .is('read_at', null)

                  const { count: personalUnread } = await supabase
                    .from('driver_organization_messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('organization_id', organizationId)
                    .eq('driver_id', driverUserId)
                    .neq('sender_id', driverUserId)
                    .is('read_at', null)

                  const total = (generalUnread || 0) + (personalUnread || 0)
                  setUnreadCount(total)
                  console.log('Счетчик обновлен после закрытия чата:', total)
                } catch (err) {
                  console.error('Ошибка обновления счетчика:', err)
                }
              }
              loadUnreadCount()
            }, 1000)
          }}
          onMessagesRead={() => {
            // Обновляем счетчик сразу после того, как сообщения отмечены как прочитанные
            // Используем функцию loadUnreadCount из useCallback
            console.log('onMessagesRead вызван, обновляем счетчик...')
            setTimeout(() => {
              loadUnreadCount()
            }, 300)
            setTimeout(() => {
              loadUnreadCount()
            }, 1000)
            setTimeout(() => {
              loadUnreadCount()
            }, 2000)
          }}
        />
      )}
    </>
  )
}

