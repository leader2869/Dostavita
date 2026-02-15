'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking'

/**
 * Компонент для автоматического отслеживания местоположения водителя
 * Водитель всегда передает свое местоположение
 */
export function DriverLocationTracker() {
  const supabase = createClient()
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)

  // Отслеживаем местоположение всегда (без проверки активных заказов)
  const { isTracking, error } = useDriverLocationTracking({
    enabled: true, // Всегда включено
    interval: 60000, // Обновляем каждую минуту (60000 мс = 60 секунд)
    orderId: activeOrderId,
  })

  useEffect(() => {
    let isMounted = true
    
    // Опционально: получаем ID активного заказа для привязки к местоположению
    // Но отслеживание местоположения работает всегда, независимо от наличия заказов
    const updateActiveOrderId = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          return
        }

        // Получаем ID первого активного заказа (если есть) для привязки к местоположению
        const { data: activeOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('executor_user_id', user.id)
          .in('status', ['courier_coming', 'courier_delivering'])
          .order('created_at', { ascending: false })
          .limit(1)

        if (isMounted) {
          if (activeOrders && activeOrders.length > 0) {
            setActiveOrderId(activeOrders[0].id)
          } else {
            setActiveOrderId(null)
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Ошибка получения активного заказа:', err)
        }
      }
    }

    // Обновляем ID активного заказа при монтировании
    updateActiveOrderId()

    // Обновляем ID активного заказа каждые 30 секунд (опционально)
    const interval = setInterval(updateActiveOrderId, 30000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, []) // Убрали supabase из зависимостей

  // Показываем ошибку, если есть проблема с отслеживанием местоположения
  if (error) {
    return (
      <div className="fixed bottom-20 left-4 right-4 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm z-50">
        <p>⚠️ {error}</p>
      </div>
    )
  }

  // Не рендерим ничего визуально, только отслеживаем местоположение
  return null
}

