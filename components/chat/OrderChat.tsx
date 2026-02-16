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

  // Прокрутка к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Загружаем сообщения
  useEffect(() => {
    let isMounted = true

    const loadMessages = async () => {
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
      } catch (err) {
        console.error('Ошибка загрузки сообщений:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadMessages()

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
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-semibold text-white">Чат по заказу</h3>
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center text-gray-400">Загрузка сообщений...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-400">Пока нет сообщений</div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === currentUserId
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${isOwn ? 'bg-blue-600' : 'bg-gray-700'} rounded-lg p-3`}>
                    {!isOwn && (
                      <p className="text-xs text-gray-300 mb-1">
                        {senderNames[msg.sender_id] || 'Неизвестный'}
                      </p>
                    )}
                    <p className="text-white text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className="text-xs text-gray-300 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
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
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите сообщение..."
              className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? '...' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

