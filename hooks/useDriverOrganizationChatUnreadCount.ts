import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useDriverOrganizationChatUnreadCount(driverUserId: string | null, organizationId: string | null) {
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    if (!driverUserId || !organizationId) {
      setUnreadCount(0)
      return
    }

    let isMounted = true

    const loadUnreadCount = async () => {
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
          console.error('Ошибка загрузки непрочитанных сообщений общего чата:', generalError)
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
          console.error('Ошибка загрузки непрочитанных сообщений личного чата:', personalError)
        }

        if (isMounted) {
          const total = (generalUnread || 0) + (personalUnread || 0)
          setUnreadCount(total)
        }
      } catch (err) {
        console.error('Ошибка подсчета непрочитанных сообщений:', err)
        if (isMounted) {
          setUnreadCount(0)
        }
      }
    }

    loadUnreadCount()

    // Подписываемся на изменения сообщений
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
          // Перезагружаем счетчик при изменении сообщений
          loadUnreadCount()
        }
      )
      .subscribe()

    // Обновляем каждые 30 секунд
    const interval = setInterval(loadUnreadCount, 30000)

    return () => {
      isMounted = false
      channel.unsubscribe()
      clearInterval(interval)
    }
  }, [driverUserId, organizationId])

  return { count: unreadCount }
}

