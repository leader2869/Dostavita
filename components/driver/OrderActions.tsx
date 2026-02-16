'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OrderActionsProps {
  order: {
    id: string
    customer_id: string
    sender_phone: string | null
    recipient_phone: string | null
    pickup_coordinates: any
    delivery_coordinates: any
  }
  onStopPropagation?: (e: React.MouseEvent) => void
}

export function OrderActions({ order, onStopPropagation }: OrderActionsProps) {
  const [showPhoneMenu, setShowPhoneMenu] = useState(false)
  const [showNavMenu, setShowNavMenu] = useState(false)
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const supabase = createClient()

  // Получаем текущее местоположение водителя
  useEffect(() => {
    const loadDriverLocation = async () => {
      setLoadingLocation(true)
      try {
        // Сначала пробуем получить из браузера (самое точное)
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setDriverLocation({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
              })
              setLoadingLocation(false)
            },
            async () => {
              // Если браузер не дал местоположение, пробуем из профиля
              try {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('current_location')
                    .eq('id', user.id)
                    .single()

                  if (profile?.current_location) {
                    const parsed = parseCoordinates(profile.current_location)
                    if (parsed) {
                      setDriverLocation(parsed)
                    }
                  }
                }
              } catch (error) {
                console.error('Ошибка загрузки местоположения из профиля:', error)
              }
              setLoadingLocation(false)
            },
            { timeout: 5000, maximumAge: 60000 }
          )
        } else {
          // Если Geolocation API не поддерживается, получаем из профиля
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('current_location')
                .eq('id', user.id)
                .single()

              if (profile?.current_location) {
                const parsed = parseCoordinates(profile.current_location)
                if (parsed) {
                  setDriverLocation(parsed)
                }
              }
            }
          } catch (error) {
            console.error('Ошибка загрузки местоположения из профиля:', error)
          }
          setLoadingLocation(false)
        }
      } catch (error) {
        console.error('Ошибка получения местоположения:', error)
        setLoadingLocation(false)
      }
    }

    loadDriverLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // supabase - стабильный объект, не нужно включать в зависимости

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onStopPropagation) onStopPropagation(e)
    setShowPhoneMenu(true)
  }

  const handleNavClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onStopPropagation) onStopPropagation(e)
    setShowNavMenu(true)
  }

  const handleCall = (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone}`
    }
    setShowPhoneMenu(false)
  }

  // Парсим координаты из разных форматов
  const parseCoordinates = (coords: any): { lat: number; lon: number } | null => {
    if (!coords) return null

    try {
      // Формат объекта с lat/lon
      if (typeof coords === 'object' && 'lat' in coords && 'lon' in coords) {
        return { lat: coords.lat, lon: coords.lon }
      }

      // Формат объекта с lat/lng
      if (typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
        return { lat: coords.lat, lon: coords.lng }
      }

      // Формат PostgreSQL POINT как объект {x: lon, y: lat}
      if (typeof coords === 'object' && 'x' in coords && 'y' in coords) {
        return { lat: coords.y, lon: coords.x }
      }

      // Формат GeoJSON с coordinates массивом [lon, lat]
      if (typeof coords === 'object' && 'coordinates' in coords && Array.isArray(coords.coordinates)) {
        return { lat: coords.coordinates[1], lon: coords.coordinates[0] }
      }

      // Формат строки PostgreSQL POINT: (lon,lat) или POINT(lon lat)
      if (typeof coords === 'string') {
        // Пробуем парсить как JSON
        try {
          const parsed = JSON.parse(coords)
          if (typeof parsed === 'object' && 'lat' in parsed && 'lon' in parsed) {
            return parsed
          }
        } catch (e) {
          // Не JSON, пробуем парсить как "(lon,lat)"
          const match = coords.match(/\(?\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*\)?/)
          if (match) {
            return { lat: parseFloat(match[2]), lon: parseFloat(match[1]) }
          }
          // Пробуем парсить как WKT формат "POINT(lon lat)"
          const wktMatch = coords.match(/POINT\(([^ ]+) ([^ ]+)\)/)
          if (wktMatch && wktMatch.length === 3) {
            return { lat: parseFloat(wktMatch[2]), lon: parseFloat(wktMatch[1]) }
          }
        }
      }
    } catch (e) {
      console.error('Ошибка парсинга координат:', e, coords)
    }

    return null
  }

  const [showNavAppMenu, setShowNavAppMenu] = useState(false)
  const [selectedNavType, setSelectedNavType] = useState<'pickup' | 'delivery' | 'full' | null>(null)

  const handleNavTypeSelect = (type: 'pickup' | 'delivery' | 'full') => {
    setSelectedNavType(type)
    setShowNavMenu(false)
    setShowNavAppMenu(true)
  }

  const openNavigation = (appIndex: number) => {
    if (!selectedNavType) return

    const pickupCoords = parseCoordinates(order.pickup_coordinates)
    const deliveryCoords = parseCoordinates(order.delivery_coordinates)

    // Список приложений навигации с их deep links
    let navApps: Array<{ name: string; url: string; fallback: string }> = []

    if (selectedNavType === 'full') {
      // Весь маршрут: текущее местоположение → точка А → точка Б
      if (!driverLocation || !pickupCoords || !deliveryCoords) {
        alert('Не все координаты доступны для построения полного маршрута')
        setShowNavAppMenu(false)
        setSelectedNavType(null)
        return
      }

      // Формируем URL для многоточечного маршрута
      navApps = [
        {
          name: 'Яндекс Навигатор',
          url: `yandexnavi://build_route?lat_from=${driverLocation.lat}&lon_from=${driverLocation.lon}&lat_via=${pickupCoords.lat}&lon_via=${pickupCoords.lon}&lat_to=${deliveryCoords.lat}&lon_to=${deliveryCoords.lon}`,
          fallback: `https://yandex.ru/maps/?rtext=${driverLocation.lat},${driverLocation.lon}~${pickupCoords.lat},${pickupCoords.lon}~${deliveryCoords.lat},${deliveryCoords.lon}&rtt=auto`
        },
        {
          name: 'Яндекс Карты',
          url: `yandexmaps://build_route?lat_from=${driverLocation.lat}&lon_from=${driverLocation.lon}&lat_via=${pickupCoords.lat}&lon_via=${pickupCoords.lon}&lat_to=${deliveryCoords.lat}&lon_to=${deliveryCoords.lon}`,
          fallback: `https://yandex.ru/maps/?rtext=${driverLocation.lat},${driverLocation.lon}~${pickupCoords.lat},${pickupCoords.lon}~${deliveryCoords.lat},${deliveryCoords.lon}&rtt=auto`
        },
        {
          name: '2ГИС',
          url: `dgis://2gis.ru/routeSearch/rsType/car/from/${driverLocation.lon},${driverLocation.lat}/to/${deliveryCoords.lon},${deliveryCoords.lat}/via/${pickupCoords.lon},${pickupCoords.lat}`,
          fallback: `https://2gis.ru/routeSearch/rsType/car/from/${driverLocation.lon},${driverLocation.lat}/to/${deliveryCoords.lon},${deliveryCoords.lat}/via/${pickupCoords.lon},${pickupCoords.lat}`
        }
      ]
    } else {
      // Одна точка назначения
      const coords = selectedNavType === 'pickup' ? pickupCoords : deliveryCoords
      
      if (!coords) {
        alert('Координаты недоступны')
        setShowNavAppMenu(false)
        setSelectedNavType(null)
        return
      }

      const lat = coords.lat
      const lon = coords.lon

      navApps = [
        {
          name: 'Яндекс Навигатор',
          url: `yandexnavi://build_route?lat_to=${lat}&lon_to=${lon}`,
          fallback: `https://yandex.ru/maps/?pt=${lon},${lat}&z=15`
        },
        {
          name: 'Яндекс Карты',
          url: `yandexmaps://build_route?lat_to=${lat}&lon_to=${lon}`,
          fallback: `https://yandex.ru/maps/?pt=${lon},${lat}&z=15`
        },
        {
          name: '2ГИС',
          url: `dgis://2gis.ru/routeSearch/rsType/car/to/${lon},${lat}`,
          fallback: `https://2gis.ru/routeSearch/rsType/car/to/${lon},${lat}`
        }
      ]
    }

    const selectedApp = navApps[appIndex]

    // Пытаемся открыть deep link
    const link = document.createElement('a')
    link.href = selectedApp.url
    link.target = '_blank'
    link.click()

    // Если deep link не сработал, открываем fallback через 1 секунду
    setTimeout(() => {
      window.open(selectedApp.fallback, '_blank')
    }, 1000)

    setShowNavAppMenu(false)
    setSelectedNavType(null)
  }

  return (
    <>
      <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
        {/* Кнопка телефона */}
        <button
          onClick={handlePhoneClick}
          className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition"
          title="Позвонить"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        </button>

        {/* Кнопка навигации */}
        <button
          onClick={handleNavClick}
          className="flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded transition"
          title="Навигация"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {/* Меню выбора телефона */}
      {showPhoneMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPhoneMenu(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-white mb-4">Кому позвонить?</h3>
            <div className="space-y-3">
              {order.sender_phone && (
                <button
                  onClick={() => handleCall(order.sender_phone!)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded transition"
                >
                  Отправитель: {order.sender_phone}
                </button>
              )}
              {order.recipient_phone && (
                <button
                  onClick={() => handleCall(order.recipient_phone!)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded transition"
                >
                  Получатель: {order.recipient_phone}
                </button>
              )}
              <button
                onClick={() => setShowPhoneMenu(false)}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Меню выбора навигации */}
      {showNavMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowNavMenu(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-white mb-4">Куда построить маршрут?</h3>
            <div className="space-y-3">
              <button
                onClick={() => handleNavTypeSelect('pickup')}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded transition"
              >
                К отправителю
              </button>
              <button
                onClick={() => handleNavTypeSelect('delivery')}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded transition"
              >
                К получателю
              </button>
              <button
                onClick={() => handleNavTypeSelect('full')}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded transition font-semibold"
                disabled={loadingLocation || !driverLocation}
              >
                {loadingLocation ? 'Загрузка местоположения...' : 'Весь маршрут'}
              </button>
              <button
                onClick={() => setShowNavMenu(false)}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Меню выбора приложения навигации */}
      {showNavAppMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
          setShowNavAppMenu(false)
          setSelectedNavType(null)
        }}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-white mb-4">Выберите приложение навигации</h3>
            <div className="space-y-3">
              <button
                onClick={() => openNavigation(0)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded transition text-left"
              >
                Яндекс Навигатор
              </button>
              <button
                onClick={() => openNavigation(1)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded transition text-left"
              >
                Яндекс Карты
              </button>
              <button
                onClick={() => openNavigation(2)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded transition text-left"
              >
                2ГИС
              </button>
              <button
                onClick={() => {
                  setShowNavAppMenu(false)
                  setSelectedNavType(null)
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

