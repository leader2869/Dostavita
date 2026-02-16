'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OrderActionsProps {
  order: {
    id: string
    customer_id: string
    recipient_phone: string | null
    pickup_coordinates: string | { lat: number; lng: number } | { x: number; y: number } | null
    delivery_coordinates: string | { lat: number; lng: number } | { x: number; y: number } | null
  }
  onStopPropagation?: (e: React.MouseEvent) => void
}

export function OrderActions({ order, onStopPropagation }: OrderActionsProps) {
  const [showPhoneMenu, setShowPhoneMenu] = useState(false)
  const [showNavMenu, setShowNavMenu] = useState(false)
  const [customerPhone, setCustomerPhone] = useState<string | null>(null)
  const [loadingPhone, setLoadingPhone] = useState(false)
  const supabase = createClient()

  // Загружаем телефон отправителя при первом открытии меню
  const loadCustomerPhone = async () => {
    if (customerPhone !== null) return // Уже загружен
    
    setLoadingPhone(true)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', order.customer_id)
        .single()
      
      if (profile) {
        setCustomerPhone(profile.phone)
      }
    } catch (error) {
      console.error('Ошибка загрузки телефона отправителя:', error)
    } finally {
      setLoadingPhone(false)
    }
  }

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onStopPropagation) onStopPropagation(e)
    loadCustomerPhone()
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
  const parseCoordinates = (coords: string | { lat: number; lng: number } | { x: number; y: number } | null): { lat: number; lon: number } | null => {
    if (!coords) return null
    
    // Формат объекта с lat/lng
    if (typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
      return { lat: coords.lat, lon: coords.lng }
    }
    
    // Формат PostgreSQL POINT как объект {x: lon, y: lat}
    if (typeof coords === 'object' && 'x' in coords && 'y' in coords) {
      return { lat: coords.y, lon: coords.x }
    }
    
    // Формат строки PostgreSQL POINT: (lon,lat) или POINT(lon lat)
    if (typeof coords === 'string') {
      const match = coords.match(/\(?\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*\)?/)
      if (match) {
        return { lat: parseFloat(match[2]), lon: parseFloat(match[1]) }
      }
    }
    
    return null
  }

  const [showNavAppMenu, setShowNavAppMenu] = useState(false)
  const [selectedNavType, setSelectedNavType] = useState<'pickup' | 'delivery' | null>(null)

  const handleNavTypeSelect = (type: 'pickup' | 'delivery') => {
    setSelectedNavType(type)
    setShowNavMenu(false)
    setShowNavAppMenu(true)
  }

  const openNavigation = (appIndex: number) => {
    if (!selectedNavType) return

    const coords = selectedNavType === 'pickup' 
      ? parseCoordinates(order.pickup_coordinates)
      : parseCoordinates(order.delivery_coordinates)
    
    if (!coords) {
      alert('Координаты недоступны')
      setShowNavAppMenu(false)
      setSelectedNavType(null)
      return
    }

    // Формируем координаты для разных приложений
    const lat = coords.lat
    const lon = coords.lon

    // Список приложений навигации с их deep links
    const navApps = [
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
              <button
                onClick={() => {
                  if (loadingPhone) return
                  if (customerPhone) {
                    handleCall(customerPhone)
                  } else {
                    alert('Телефон отправителя не найден')
                  }
                }}
                disabled={loadingPhone}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded transition disabled:opacity-50"
              >
                {loadingPhone ? 'Загрузка...' : `Отправитель${customerPhone ? `: ${customerPhone}` : ''}`}
              </button>
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
                К отправителю (точка А)
              </button>
              <button
                onClick={() => handleNavTypeSelect('delivery')}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded transition"
              >
                К получателю (точка Б)
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
                📱 Яндекс Навигатор
              </button>
              <button
                onClick={() => openNavigation(1)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded transition text-left"
              >
                🗺️ Яндекс Карты
              </button>
              <button
                onClick={() => openNavigation(2)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-3 rounded transition text-left"
              >
                📍 2ГИС
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

