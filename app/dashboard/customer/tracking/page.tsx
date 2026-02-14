'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { DriverLocationMap } from '@/components/map/DriverLocationMap'

export default function CustomerTrackingPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        router.push('/login')
        return
      }

      setUser(currentUser)

      // Получаем водителей организации только с активными заказами
      const { data: driversData, error: driversError } = await supabase
        .rpc('get_organization_drivers_with_active_orders', { organization_user_id: currentUser.id })

      if (driversError) {
        console.error('Ошибка загрузки водителей:', driversError)
      } else {
        setDrivers(driversData || [])
        if (driversData && driversData.length > 0 && !selectedDriver) {
          setSelectedDriver(driversData[0].id)
        }
      }
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, selectedDriver])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Обновляем данные каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      loadData()
    }, 30000)

    return () => clearInterval(interval)
  }, [loadData])

  const formatLocation = (location: any) => {
    if (!location) return 'Местоположение не определено'
    // location - это POINT, нужно извлечь координаты
    // В PostgreSQL POINT хранится как строка "(x,y)" или как объект
    if (typeof location === 'string') {
      const coords = location.replace(/[()]/g, '').split(',')
      return `Широта: ${coords[0]}, Долгота: ${coords[1]}`
    }
    return 'Местоположение не определено'
  }

  if (loading) {
    return (
      <div className="pb-20">
        <BackButton />
        <h1 className="text-3xl font-bold mb-6 text-white">Отслеживание водителей</h1>
        <div className="text-center py-8 text-gray-400">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Отслеживание водителей</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Список водителей */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-white">Водители</h2>
            <div className="space-y-2">
              {drivers.map((driver: any) => (
                <button
                  key={driver.id}
                  onClick={() => setSelectedDriver(driver.id)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedDriver === driver.id
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {driver.avatar_url ? (
                      <img
                        src={driver.avatar_url}
                        alt={driver.full_name || 'Водитель'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{driver.full_name || 'Без имени'}</p>
                      <p className="text-xs opacity-75">
                        {driver.current_location ? '📍 Онлайн' : '⚫ Офлайн'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Карта и информация о водителе */}
        <div className="lg:col-span-2">
          {selectedDriver ? (
            (() => {
              const driver = drivers.find((d: any) => d.id === selectedDriver)
              if (!driver) return null

              return (
                <div className="bg-gray-800 rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4 text-white">
                    {driver.full_name || 'Без имени'}
                  </h2>

                  <div className="space-y-4">
                    {/* Местоположение - показываем только если есть активный заказ */}
                    {driver.active_order_id ? (
                      <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-2">Текущее местоположение</h3>
                        {driver.current_location ? (
                          <div className="bg-gray-700 rounded-lg p-4">
                            <p className="text-white font-mono text-sm">
                              {formatLocation(driver.current_location)}
                            </p>
                            {driver.location_updated_at && (
                              <p className="text-gray-400 text-xs mt-2">
                                Обновлено: {new Date(driver.location_updated_at).toLocaleString('ru-RU')}
                              </p>
                            )}
                            {/* Карта с местоположением водителя */}
                            <div className="mt-4">
                              <DriverLocationMap
                                driverId={driver.id}
                                orderId={driver.active_order_id}
                                height="400px"
                                zoom={15}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-700 rounded-lg p-4">
                            <p className="text-gray-400">Местоположение не определено</p>
                            <p className="text-gray-500 text-xs mt-2">
                              Водитель не передает данные о местоположении
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-700 rounded-lg p-4">
                        <p className="text-gray-400">Нет активных заказов</p>
                        <p className="text-gray-500 text-xs mt-2">
                          Местоположение водителя доступно только при наличии активного заказа
                        </p>
                      </div>
                    )}

                    {/* Информация о водителе */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-2">Информация</h3>
                      <div className="bg-gray-700 rounded-lg p-4 space-y-2 text-sm">
                        <p className="text-gray-300">
                          <span className="text-gray-400">Телефон:</span> {driver.phone || 'Не указан'}
                        </p>
                        <p className="text-gray-300">
                          <span className="text-gray-400">Транспорт:</span> {
                            driver.vehicle_type === 'car' ? 'Автомобиль' :
                            driver.vehicle_type === 'motorcycle' ? 'Мотоцикл' :
                            driver.vehicle_type === 'bicycle' ? 'Велосипед' :
                            driver.vehicle_type === 'walking' ? 'Пешком' : driver.vehicle_type || 'Не указан'
                          }
                        </p>
                        {driver.vehicle_number && (
                          <p className="text-gray-300">
                            <span className="text-gray-400">Номер:</span> {driver.vehicle_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="bg-gray-800 rounded-lg shadow p-6">
              <p className="text-gray-400 text-center py-8">Выберите водителя для отслеживания</p>
            </div>
          )}
        </div>
      </div>

      {/* Нижняя навигация */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex justify-around items-center h-16">
          <a
            href="/dashboard/customer"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Главная</span>
          </a>
          <a
            href="/dashboard/customer/drivers"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs">Водители</span>
          </a>
          <a
            href="/dashboard/customer/orders"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Заказы</span>
          </a>
          <a
            href="/dashboard/customer/finance"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">Финансы</span>
          </a>
          <a
            href="/dashboard/customer/tracking"
            className="flex flex-col items-center justify-center flex-1 h-full text-green-400 hover:text-green-300 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">Отслеживание</span>
          </a>
        </div>
      </div>
    </div>
  )
}

