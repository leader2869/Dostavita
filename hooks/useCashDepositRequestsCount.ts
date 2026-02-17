'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useCashDepositRequestsCount() {
  const [count, setCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    let isMounted = true

    const loadCount = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (isMounted) {
            setCount(0)
            setLoading(false)
          }
          return
        }

        // Получаем количество pending запросов на сдачу кассы для организации
        const { data, count, error } = await supabase
          .from('cash_deposit_requests')
          .select('id', { count: 'exact', head: false })
          .eq('organization_id', user.id)
          .eq('status', 'pending')

        if (!isMounted) return

        if (error) {
          console.error('Ошибка загрузки количества запросов на сдачу кассы:', error)
          setCount(0)
        } else {
          // Используем count если доступен, иначе длину массива data
          const finalCount = count !== null && count !== undefined ? count : (data?.length || 0)
          setCount(finalCount)
        }
      } catch (err) {
        console.error('Ошибка в useCashDepositRequestsCount:', err)
        if (isMounted) {
          setCount(0)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadCount()

    // Подписываемся на изменения в таблице cash_deposit_requests
    let channel: any = null
    
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted) return
      
      channel = supabase
        .channel(`cash_deposit_requests_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cash_deposit_requests',
            filter: `organization_id=eq.${user.id}`
          },
          () => {
            if (isMounted) {
              loadCount()
            }
          }
        )
        .subscribe()
    }
    
    setupSubscription().catch((err) => {
      console.error('Ошибка подписки на изменения cash_deposit_requests:', err)
    })

    return () => {
      isMounted = false
      if (channel) {
        channel.unsubscribe().catch(console.error)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { count, loading }
}

