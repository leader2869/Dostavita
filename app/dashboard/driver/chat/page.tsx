'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DriverOrganizationChat } from '@/components/chat/DriverOrganizationChat'

export default function DriverChatPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeChat, setActiveChat] = useState<'general' | string | null>(null)
  const [personalChats, setPersonalChats] = useState<any[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) return

        setUser(currentUser)

        // Получаем профиль водителя
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, organization_id, role')
          .eq('id', currentUser.id)
          .single()

        if (profileData) {
          setProfile(profileData)

          // Если водитель привязан к организации, загружаем личные чаты
          if (profileData.organization_id) {
            // Получаем последние сообщения из личных чатов
            const { data: personalMessages } = await supabase
              .from('driver_organization_messages')
              .select('*, profiles!driver_organization_messages_sender_id_fkey(id, full_name, email)')
              .eq('organization_id', profileData.organization_id)
              .eq('driver_id', currentUser.id)
              .order('created_at', { ascending: false })
              .limit(50)

            if (personalMessages) {
              // Группируем по отправителям (организация)
              const chatsMap = new Map()
              personalMessages.forEach((msg: any) => {
                if (msg.sender_id !== currentUser.id) {
                  // Это сообщение от организации
                  if (!chatsMap.has(msg.organization_id)) {
                    chatsMap.set(msg.organization_id, {
                      organizationId: msg.organization_id,
                      driverId: currentUser.id,
                      lastMessage: msg,
                      unreadCount: 0
                    })
                  }
                }
              })
              setPersonalChats(Array.from(chatsMap.values()))
            }
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки данных:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="pb-20">
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }

  if (!profile?.organization_id) {
    return (
      <div className="pb-20">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Чаты</h1>
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <p className="text-gray-600 text-center py-8">
            Вы не привязаны к организации. Чаты будут доступны после привязки к организации.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Чаты</h1>

      <div className="space-y-4">
        {/* Общий чат компании */}
        <div className="bg-gray-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Общий чат компании</h3>
                <p className="text-sm text-gray-600">Чат для всех водителей организации</p>
              </div>
            </div>
            <button
              onClick={() => setActiveChat('general')}
              className="bg-brand-light hover:bg-brand-dark text-gray-900 px-4 py-2 rounded transition"
            >
              Открыть
            </button>
          </div>
        </div>

        {/* Личные сообщения от организации */}
        {personalChats.length > 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Личные сообщения</h2>
            <div className="space-y-2">
              {personalChats.map((chat) => (
                <div
                  key={chat.organizationId}
                  className="flex items-center justify-between p-3 bg-gray-100 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                  onClick={() => setActiveChat(`personal_${chat.organizationId}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-gray-900 font-medium">Организация</h3>
                      {chat.lastMessage && (
                        <p className="text-sm text-gray-600 truncate max-w-xs">
                          {chat.lastMessage.message || 'Фото'}
                        </p>
                      )}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Кнопка для создания личного чата с организацией */}
        <div className="bg-gray-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Личный чат с организацией</h3>
                <p className="text-sm text-gray-600">Приватный чат с вашей организацией</p>
              </div>
            </div>
            <button
              onClick={() => setActiveChat(`personal_${profile.organization_id}`)}
              className="bg-purple-600 hover:bg-purple-700 text-gray-900 px-4 py-2 rounded transition"
            >
              Открыть
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно чата */}
      {activeChat && user && profile && (
        <DriverOrganizationChat
          organizationId={profile.organization_id}
          driverId={activeChat === 'general' ? null : user.id}
          currentUserId={user.id}
          currentUserRole="driver"
          onClose={() => setActiveChat(null)}
        />
      )}
    </div>
  )
}

