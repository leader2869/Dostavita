'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDashboardUser } from '@/contexts/DashboardAuthContext'
import { DriverClientChatsSection } from '@/components/driver/DriverClientChatsSection'

export default function DriverChatPage() {
  const supabase = createClient()
  const { userId } = useDashboardUser()
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('id, order_number, pickup_address, delivery_address, status, created_at, client_id')
          .eq('executor_user_id', userId)
          .in('status', ['courier_accepted', 'courier_coming', 'courier_delivering'])
          .order('created_at', { ascending: false })

        if (!ordersError && ordersData) {
          setActiveOrders(ordersData || [])
        }
      } catch (err) {
        console.error('Ошибка загрузки данных:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase, userId])

  if (loading) {
    return (
      <div className="pb-20">
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Чаты</h1>

      <DriverClientChatsSection
        driverUserId={userId}
        activeOrders={activeOrders}
      />

      {activeOrders.length === 0 && (
        <div className="bg-gray-50 rounded-lg shadow p-6">
          <p className="text-gray-600 text-center py-8">
            У вас пока нет активных заказов. Чаты с клиентами будут доступны, когда у вас появятся активные заказы.
          </p>
        </div>
      )}
    </div>
  )
}
