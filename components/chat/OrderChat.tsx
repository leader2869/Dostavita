'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OrderChatProps {
  orderId: string
  currentUserId: string
  onClose: () => void
}

interface Message {
  id: string
  order_id: string
  sender_id: string
  message: string
  created_at: string
  read_at: string | null
}

export function OrderChat({ orderId, currentUserId, onClose }: OrderChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false)

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
      const { data, error } = await supabase
        .from('order_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })

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
    }
  }

  // Загружаем сообщения при монтировании
  useEffect(() => {
    let isMounted = true

    const initialLoad = async () => {
      try {
        const { data, error } = await supabase
          .from('order_messages')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })

        if (error) throw error

        if (isMounted) {
          setMessages(data || [])
          
          // Загружаем имена отправителей
          const uniqueSenderIds = [...new Set((data || []).map(m => m.sender_id))]
          if (uniqueSenderIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', uniqueSenderIds)

            if (profiles && isMounted) {
              const names: Record<string, string> = {}
              profiles.forEach(p => {
                names[p.id] = p.full_name || p.email || 'Неизвестный'
              })
              setSenderNames(names)
            }
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки сообщений:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initialLoad()

    // Подписываемся на новые сообщения через Realtime
    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_messages',
          filter: `order_id=eq.${orderId}`,
        },
        async (payload) => {
          if (isMounted) {
            const newMessage = payload.new as Message
            
            // Проверяем, нет ли уже этого сообщения в списке (чтобы избежать дубликатов)
            setMessages(prev => {
              const exists = prev.some(m => m.id === newMessage.id)
              if (exists) return prev
              return [...prev, newMessage]
            })

            // Если модальное окно открыто и сообщение от другого пользователя, отмечаем его как прочитанное
            if (newMessage.sender_id !== currentUserId && newMessage.read_at === null) {
              const { error } = await supabase
                .from('order_messages')
                .update({ read_at: new Date().toISOString() })
                .eq('id', newMessage.id)

              if (!error) {
                // Обновляем локальное состояние
                setMessages(prev => prev.map(m => 
                  m.id === newMessage.id 
                    ? { ...m, read_at: new Date().toISOString() }
                    : m
                ))
              }
            }

            // Загружаем имя отправителя, если его еще нет
            if (!senderNames[newMessage.sender_id]) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('id', newMessage.sender_id)
                .single()

              if (profile && isMounted) {
                setSenderNames(prev => ({
                  ...prev,
                  [newMessage.sender_id]: profile.full_name || profile.email || 'Неизвестный'
                }))
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  // Отмечаем все непрочитанные сообщения как прочитанные при открытии модального окна
  useEffect(() => {
    if (hasMarkedAsRead || loading || messages.length === 0) return

    const markMessagesAsRead = async () => {
      try {
        // Находим все непрочитанные сообщения от других пользователей
        const unreadMessages = messages.filter(
          m => m.sender_id !== currentUserId && m.read_at === null
        )

        if (unreadMessages.length === 0) {
          setHasMarkedAsRead(true)
          return
        }

        // Отмечаем их как прочитанные
        const messageIds = unreadMessages.map(m => m.id)
        const { error } = await supabase
          .from('order_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', messageIds)

        if (error) {
          console.error('Ошибка отметки сообщений как прочитанных:', error)
        } else {
          // Обновляем локальное состояние
          setMessages(prev => prev.map(m => 
            messageIds.includes(m.id) 
              ? { ...m, read_at: new Date().toISOString() }
              : m
          ))
          setHasMarkedAsRead(true)
        }
      } catch (err) {
        console.error('Ошибка при отметке сообщений как прочитанных:', err)
      }
    }

    // Небольшая задержка, чтобы пользователь успел увидеть сообщения
    const timer = setTimeout(() => {
      markMessagesAsRead()
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentUserId, loading, hasMarkedAsRead])

  // Автоматическое обновление сообщений каждые 3 секунды, пока модальное окно открыто
  useEffect(() => {
    // Загружаем сообщения сразу при открытии
    loadMessages()

    // Устанавливаем интервал для обновления каждые 3 секунды
    const interval = setInterval(() => {
      loadMessages()
    }, 3000)

    // Очищаем интервал при размонтировании компонента
    return () => {
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  // Сбрасываем флаг при закрытии модального окна
  useEffect(() => {
    return () => {
      setHasMarkedAsRead(false)
    }
  }, [])

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return

    const messageText = newMessage.trim()
    setSending(true)
    
    // Оптимистично добавляем сообщение в список сразу
    const tempMessage: Message = {
      id: `temp-${Date.now()}`, // Временный ID
      order_id: orderId,
      sender_id: currentUserId,
      message: messageText,
      created_at: new Date().toISOString(),
      read_at: null,
    }
    
    setMessages(prev => [...prev, tempMessage])
    setNewMessage('')

    try {
      const { data, error } = await supabase
        .from('order_messages')
        .insert({
          order_id: orderId,
          sender_id: currentUserId,
          message: messageText,
        })
        .select()
        .single()

      if (error) throw error

      // Заменяем временное сообщение на реальное из базы
      if (data) {
        setMessages(prev => {
          // Удаляем временное сообщение и добавляем реальное
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-50 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-semibold text-gray-900">Чат по заказу</h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center text-gray-600">Загрузка сообщений...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-600">Пока нет сообщений</div>
          ) : (
            messages.map((msg) => {
              return (
                <div
                  key={msg.id}
                  className="flex justify-start"
                >
                  <div className="max-w-[75%] bg-gray-200 rounded-lg p-3">
                    <div className="text-xs mb-1 text-gray-900">
                      {senderNames[msg.sender_id] || 'Неизвестный'}
                    </div>
                    <p className="text-gray-900 text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    <div className="text-xs mt-1 text-gray-600">
                      {new Date(msg.created_at).toLocaleTimeString('ru-RU', {
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
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите сообщение..."
              className="flex-1 bg-gray-100 text-gray-900 rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="bg-brand-light hover:bg-brand-dark text-gray-900 px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

