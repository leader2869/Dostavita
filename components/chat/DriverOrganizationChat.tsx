'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface DriverOrganizationChatProps {
  organizationId: string
  driverId: string | null // null для общего чата, UUID для личного чата
  currentUserId: string
  currentUserRole: 'driver' | 'customer'
  onClose: () => void
}

interface Message {
  id: string
  organization_id: string
  driver_id: string | null
  sender_id: string
  message: string | null
  photo_url: string | null
  created_at: string
  read_at: string | null
}

export function DriverOrganizationChat({
  organizationId,
  driverId,
  currentUserId,
  currentUserRole,
  onClose
}: DriverOrganizationChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false)

  const chatType = driverId ? 'personal' : 'general'
  const chatTitle = driverId ? 'Личный чат' : 'Общий чат'

  // Прокрутка к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Функция загрузки сообщений
  const loadMessages = async () => {
    try {
      let query = supabase
        .from('driver_organization_messages')
        .select('*')
        .eq('organization_id', organizationId)

      if (driverId) {
        // Личный чат
        query = query.eq('driver_id', driverId)
      } else {
        // Общий чат
        query = query.is('driver_id', null)
      }

      query = query.order('created_at', { ascending: true })

      const { data, error } = await query

      if (error) throw error

      setMessages(data || [])
      
      // Загружаем имена отправителей
      const uniqueSenderIds = [...new Set((data || []).map(m => m.sender_id))]
      if (uniqueSenderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', uniqueSenderIds)

        if (profiles) {
          const names: Record<string, string> = {}
          profiles.forEach(p => {
            names[p.id] = p.full_name || p.email || 'Неизвестный'
          })
          setSenderNames(prev => ({ ...prev, ...names }))
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки сообщений:', err)
    } finally {
      setLoading(false)
    }
  }

  // Загружаем сообщения при монтировании
  useEffect(() => {
    loadMessages()

    // Подписываемся на новые сообщения
    const channel = supabase
      .channel(`driver_org_chat_${organizationId}_${driverId || 'general'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_organization_messages',
          filter: driverId 
            ? `organization_id=eq.${organizationId},driver_id=eq.${driverId}`
            : `organization_id=eq.${organizationId},driver_id=is.null`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as Message
            setMessages(prev => [...prev, newMessage])
            
            // Загружаем имя отправителя, если его еще нет
            if (!senderNames[newMessage.sender_id]) {
              supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('id', newMessage.sender_id)
                .single()
                .then(({ data: profile }) => {
                  if (profile) {
                    setSenderNames(prev => ({
                      ...prev,
                      [newMessage.sender_id]: profile.full_name || profile.email || 'Неизвестный'
                    }))
                  }
                })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new as Message
            setMessages(prev =>
              prev.map(m => m.id === updatedMessage.id ? updatedMessage : m)
            )
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [organizationId, driverId])

  // Отмечаем сообщения как прочитанные при открытии чата
  useEffect(() => {
    if (!hasMarkedAsRead && messages.length > 0) {
      const unreadMessages = messages.filter(
        m => m.sender_id !== currentUserId && !m.read_at
      )

      if (unreadMessages.length > 0) {
        // Обновляем read_at для непрочитанных сообщений
        const messageIds = unreadMessages.map(m => m.id)
        supabase
          .from('driver_organization_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', messageIds)
          .then(() => {
            setHasMarkedAsRead(true)
            // Обновляем локальное состояние
            setMessages(prev =>
              prev.map(m =>
                messageIds.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m
              )
            )
          })
      } else {
        setHasMarkedAsRead(true)
      }
    }
  }, [messages, currentUserId, hasMarkedAsRead])

  const handleSend = async () => {
    if ((!newMessage.trim() && !uploadingPhoto) || sending) return

    const messageText = newMessage.trim()
    setSending(true)
    
    // Оптимистично добавляем сообщение в список сразу
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      organization_id: organizationId,
      driver_id: driverId,
      sender_id: currentUserId,
      message: messageText || null,
      photo_url: null,
      created_at: new Date().toISOString(),
      read_at: null,
    }
    
    setMessages(prev => [...prev, tempMessage])
    setNewMessage('')

    try {
      const { data, error } = await supabase
        .from('driver_organization_messages')
        .insert({
          organization_id: organizationId,
          driver_id: driverId,
          sender_id: currentUserId,
          message: messageText || null,
        })
        .select()
        .single()

      if (error) throw error

      // Заменяем временное сообщение на реальное из базы
      if (data) {
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempMessage.id)
          return [...filtered, data as Message]
        })

        // Загружаем имя отправителя, если его еще нет
        if (!senderNames[currentUserId]) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', currentUserId)
            .single()

          if (profile) {
            setSenderNames(prev => ({
              ...prev,
              [currentUserId]: profile.full_name || profile.email || 'Неизвестный'
            }))
          }
        }
      }
    } catch (err) {
      console.error('Ошибка отправки сообщения:', err)
      // Удаляем временное сообщение при ошибке
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id))
      setNewMessage(messageText) // Возвращаем текст в поле ввода
      alert('Не удалось отправить сообщение')
    } finally {
      setSending(false)
    }
  }

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5 МБ')
      return
    }

    setUploadingPhoto(true)

    try {
      // Загружаем фото в Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${organizationId}/${driverId || 'general'}/${Date.now()}.${fileExt}`
      const filePath = `driver-org-chat/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-photos')
        .getPublicUrl(filePath)

      // Отправляем сообщение с фото
      const { data, error } = await supabase
        .from('driver_organization_messages')
        .insert({
          organization_id: organizationId,
          driver_id: driverId,
          sender_id: currentUserId,
          message: newMessage.trim() || null,
          photo_url: publicUrl,
        })
        .select()
        .single()

      if (error) throw error

      // Добавляем сообщение в список
      if (data) {
        setMessages(prev => [...prev, data as Message])
        setNewMessage('')

        // Загружаем имя отправителя, если его еще нет
        if (!senderNames[currentUserId]) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', currentUserId)
            .single()

          if (profile) {
            setSenderNames(prev => ({
              ...prev,
              [currentUserId]: profile.full_name || profile.email || 'Неизвестный'
            }))
          }
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки фото:', err)
      alert('Не удалось загрузить фото')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handlePhotoUpload(file)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-semibold text-white">{chatTitle}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Сообщения */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          style={{ maxHeight: 'calc(80vh - 140px)' }}
        >
          {loading ? (
            <div className="text-center text-gray-400 py-8">Загрузка сообщений...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">Нет сообщений</div>
          ) : (
            messages.map((message) => {
              const isOwn = message.sender_id === currentUserId
              const senderName = senderNames[message.sender_id] || 'Неизвестный'

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] ${isOwn ? 'bg-blue-600' : 'bg-gray-700'} rounded-lg p-3`}>
                    {!isOwn && (
                      <div className="text-xs text-gray-300 mb-1">{senderName}</div>
                    )}
                    {message.photo_url && (
                      <div className="mb-2">
                        <Image
                          src={message.photo_url}
                          alt="Фото"
                          width={300}
                          height={300}
                          className="rounded-lg max-w-full h-auto"
                          unoptimized
                        />
                      </div>
                    )}
                    {message.message && (
                      <div className={`text-sm ${isOwn ? 'text-white' : 'text-gray-100'}`}>
                        {message.message}
                      </div>
                    )}
                    <div className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                      {new Date(message.created_at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Поле ввода */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto || sending}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded transition disabled:opacity-50"
              title="Отправить фото"
            >
              {uploadingPhoto ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите сообщение..."
              className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={sending || uploadingPhoto}
            />
            <button
              onClick={handleSend}
              disabled={(!newMessage.trim() && !uploadingPhoto) || sending || uploadingPhoto}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

