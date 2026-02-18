'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { DriverLocationMap } from '@/components/map/DriverLocationMap'
import { CustomerBottomNavigation } from '@/components/customer/CustomerBottomNavigation'

export default function CustomerTrackingPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]) // Формат YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState<string>('') // Время в формате HH:MM
  const [trackPoints, setTrackPoints] = useState<Array<{ lat: number; lon: number; time: string }>>([])
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lon: number } | null>(null)

  const loadData = useCallback(async () => {
    let isMounted = true
    
    try {
      if (isMounted) {
        setLoading(true)
      }
      
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Ошибка аутентификации:', authError)
        if (isMounted) {
          router.push('/login')
        }
        return
      }

      if (!currentUser) {
        if (isMounted) {
          router.push('/login')
        }
        return
      }

      if (isMounted) {
        setUser(currentUser)
      }

      // Получаем всех водителей организации (не только с активными заказами)
      // Используем get_organization_drivers, которая возвращает всех водителей
      const { data: driversData, error: driversError } = await supabase
        .rpc('get_organization_drivers', { organization_user_id: currentUser.id })

      if (driversError) {
        console.error('Ошибка загрузки водителей:', driversError)
        if (isMounted) {
          setDrivers([])
        }
      } else {
        if (isMounted) {
          setDrivers(driversData || [])
          if (driversData && driversData.length > 0 && !selectedDriver) {
            setSelectedDriver(driversData[0].id)
          }
        }
      }
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
      setDrivers([])
    } finally {
      setLoading(false)
    }
  }, [supabase, router, selectedDriver])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Загружаем трек водителя за выбранный день
  useEffect(() => {
    if (!selectedDriver || !selectedDate) {
      setTrackPoints([])
      setCurrentPosition(null)
      return
    }

    const loadTrack = async () => {
      try {
        const { data: trackData, error: trackError } = await supabase
          .rpc('get_driver_track', {
            p_driver_id: selectedDriver,
            p_date: selectedDate,
          })

        if (!trackError && trackData && trackData.length > 0) {
          const points = trackData
            .map((point: any) => ({
              lat: parseFloat(point.latitude),
              lon: parseFloat(point.longitude),
              time: new Date(point.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
              timestamp: new Date(point.created_at).getTime(),
            }))
            .filter((p: any) => !isNaN(p.lat) && !isNaN(p.lon))
          
          setTrackPoints(points)
          
          // Если выбрано время, находим ближайшую точку
          if (selectedTime) {
            const [hours, minutes] = selectedTime.split(':').map(Number)
            const selectedTimestamp = new Date(`${selectedDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`).getTime()
            
            // Находим ближайшую точку по времени
            let closestPoint = points[0]
            let minDiff = Math.abs(points[0].timestamp - selectedTimestamp)
            
            for (const point of points) {
              const diff = Math.abs(point.timestamp - selectedTimestamp)
              if (diff < minDiff) {
                minDiff = diff
                closestPoint = point
              }
            }
            
            setCurrentPosition({ lat: closestPoint.lat, lon: closestPoint.lon })
          } else if (points.length > 0) {
            // Если время не выбрано, показываем последнюю точку
            const lastPoint = points[points.length - 1]
            setCurrentPosition({ lat: lastPoint.lat, lon: lastPoint.lon })
          }
        } else {
          setTrackPoints([])
          setCurrentPosition(null)
        }
      } catch (err) {
        console.error('Ошибка загрузки трека:', err)
        setTrackPoints([])
        setCurrentPosition(null)
      }
    }

    loadTrack()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDriver, selectedDate, selectedTime]) // supabase - стабильный объект, не нужно включать в зависимости

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
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Отслеживание водителей</h1>
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Отслеживание водителей</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Список водителей */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Водители</h2>
            {drivers.length === 0 ? (
              <div className="text-center py-4 text-gray-600 text-sm">
                Нет водителей в организации
              </div>
            ) : (
              <div className="space-y-2">
                {drivers.map((driver: any) => (
                <button
                  key={driver.id}
                  onClick={() => setSelectedDriver(driver.id)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedDriver === driver.id
                      ? 'bg-brand-light text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
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
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{driver.full_name || 'Без имени'}</p>
                      <p className="text-xs opacity-75">
                        {driver.active_order_id ? (
                          <span className="text-brand-light">📍 Активный заказ</span>
                        ) : (
                          <span className="text-gray-500">⚫ Нет активных заказов</span>
                        )}
                        {driver.current_location && (
                          <span className="ml-2 text-blue-400">📍 Есть местоположение</span>
                        )}
                      </p>
                    </div>
                  </div>
                </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Карта и информация о водителе */}
        <div className="lg:col-span-2">
          {selectedDriver ? (
            (() => {
              const driver = drivers.find((d: any) => d.id === selectedDriver)
              if (!driver) return null

              return (
                <div className="bg-gray-50 rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-900">
                    {driver.full_name || 'Без имени'}
                  </h2>

                  <div className="space-y-4">
                    {/* Выбор даты и времени для просмотра трека */}
                    <div className="bg-gray-100 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-600 mb-3">Просмотр трека</h3>
                      
                      {/* Выбор даты */}
                      <div className="mb-4">
                        <label className="block text-xs text-gray-600 mb-2">Выберите день:</label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => {
                            setSelectedDate(e.target.value)
                            setSelectedTime('')
                          }}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full bg-gray-600 text-gray-900 px-3 py-2 rounded-lg border border-gray-500 focus:border-green-400 focus:outline-none"
                        />
                      </div>

                      {/* Шкала времени */}
                      {trackPoints.length > 0 && (
                        <div className="mb-4">
                          <label className="block text-xs text-gray-600 mb-2">
                            Время: {selectedTime || trackPoints[0]?.time || 'Не выбрано'}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max={trackPoints.length - 1}
                            value={selectedTime ? trackPoints.findIndex((p) => p.time === selectedTime) : trackPoints.length - 1}
                            onChange={(e) => {
                              const index = parseInt(e.target.value)
                              if (trackPoints[index]) {
                                setSelectedTime(trackPoints[index].time)
                              }
                            }}
                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-400"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{trackPoints[0]?.time || ''}</span>
                            <span>{trackPoints[trackPoints.length - 1]?.time || ''}</span>
                          </div>
                        </div>
                      )}

                      {/* Кнопка сброса времени */}
                      {selectedTime && (
                        <button
                          onClick={() => setSelectedTime('')}
                          className="text-xs text-brand-light hover:text-brand-dark"
                        >
                          Показать весь трек
                        </button>
                      )}
                    </div>

                    {/* Местоположение - показываем всегда для всех водителей организации */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-600 mb-2">
                        {selectedTime ? `Местоположение в ${selectedTime}` : 'Текущее местоположение'}
                      </h3>
                      {(currentPosition || driver.current_location) ? (
                        <div className="bg-gray-100 rounded-lg p-4">
                          {currentPosition && (
                            <p className="text-gray-900 font-mono text-sm mb-2">
                              Широта: {currentPosition.lat.toFixed(6)}, Долгота: {currentPosition.lon.toFixed(6)}
                            </p>
                          )}
                          {driver.location_updated_at && !selectedTime && (
                            <p className="text-gray-600 text-xs mt-2">
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
                              showTrack={true}
                              trackDate={new Date(selectedDate)}
                              selectedTime={selectedTime}
                              currentPosition={currentPosition}
                              trackPoints={selectedTime ? trackPoints.filter(p => {
                                const pointTime = p.time
                                const [pointHours, pointMinutes] = pointTime.split(':').map(Number)
                                const [selectedHours, selectedMinutes] = selectedTime.split(':').map(Number)
                                const pointTotal = pointHours * 60 + pointMinutes
                                const selectedTotal = selectedHours * 60 + selectedMinutes
                                return pointTotal <= selectedTotal
                              }) : trackPoints}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-100 rounded-lg p-4">
                          <p className="text-gray-600">Местоположение не определено</p>
                          <p className="text-gray-500 text-xs mt-2">
                            {selectedDate === new Date().toISOString().split('T')[0] 
                              ? 'Водитель не передает данные о местоположении'
                              : 'Нет данных за выбранный день'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Информация о водителе */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-600 mb-2">Информация</h3>
                      <div className="bg-gray-100 rounded-lg p-4 space-y-2 text-sm">
                        <p className="text-gray-700">
                          <span className="text-gray-600">Телефон:</span> {driver.phone || 'Не указан'}
                        </p>
                        <p className="text-gray-700">
                          <span className="text-gray-600">Транспорт:</span> {
                            driver.vehicle_type === 'car' ? 'Автомобиль' :
                            driver.vehicle_type === 'motorcycle' ? 'Мотоцикл' :
                            driver.vehicle_type === 'bicycle' ? 'Велосипед' :
                            driver.vehicle_type === 'walking' ? 'Пешком' : driver.vehicle_type || 'Не указан'
                          }
                          {driver.vehicle_brand && driver.vehicle_model && (
                            <span className="ml-1">({driver.vehicle_brand} {driver.vehicle_model})</span>
                          )}
                        </p>
                        {driver.vehicle_number && (
                          <p className="text-gray-700">
                            <span className="text-gray-600">Номер:</span> {driver.vehicle_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="bg-gray-50 rounded-lg shadow p-6">
              <p className="text-gray-600 text-center py-8">Выберите водителя для отслеживания</p>
            </div>
          )}
        </div>
      </div>

      <CustomerBottomNavigation />
    </div>
  )
}

