'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { createClient } from '@/lib/supabase/client'

// Исправление иконок по умолчанию для Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface DriverLocationMapProps {
  driverId: string
  orderId?: string
  height?: string
  zoom?: number
  showUserLocation?: boolean
  showTrack?: boolean // Показывать ли трек водителя за день
  trackDate?: Date // Дата для отображения трека (по умолчанию сегодня)
}

// Компонент для обновления центра карты (только если нет трека)
function MapCenter({ center, zoom, hasTrack }: { center: [number, number], zoom: number, hasTrack: boolean }) {
  const map = useMap()
  
  useEffect(() => {
    // Не обновляем центр, если есть трек - трек сам управляет границами
    if (!hasTrack && map && map.getContainer()) {
      try {
        map.setView(center, zoom, { animate: false })
      } catch (e) {
        // Игнорируем ошибки, если карта еще не готова
        console.warn('Ошибка обновления центра карты:', e)
      }
    }
  }, [map, center, zoom, hasTrack])
  
  return null
}

// Компонент для отображения трека водителя
function DriverTrack({ trackPoints, currentLocation }: { trackPoints: Array<{ lat: number; lon: number }>, currentLocation: { lat: number; lon: number } | null }) {
  const map = useMap()
  const boundsSetRef = useRef(false)
  const trackPointsRef = useRef<string>('')
  
  useEffect(() => {
    if (!map || !map.getContainer()) {
      return
    }

    if (trackPoints.length > 0) {
      // Создаем уникальный ключ из количества точек трека
      const trackKey = `${trackPoints.length}-${trackPoints[0]?.lat}-${trackPoints[0]?.lon}`
      
      // Устанавливаем границы только если трек изменился (новые точки добавились)
      if (trackKey !== trackPointsRef.current) {
        trackPointsRef.current = trackKey
        
        try {
          // Создаем границы из трека и текущего местоположения
          const allPoints = [...trackPoints]
          if (currentLocation) {
            allPoints.push(currentLocation)
          }
          
          if (allPoints.length > 0) {
            const bounds = L.latLngBounds(allPoints.map(p => [p.lat, p.lon] as L.LatLngExpression))
            
            // Устанавливаем границы только один раз при первой загрузке трека
            if (!boundsSetRef.current) {
              // Небольшая задержка, чтобы карта успела инициализироваться
              setTimeout(() => {
                if (map && map.getContainer()) {
                  try {
                    map.fitBounds(bounds, { padding: [50, 50], animate: false })
                    boundsSetRef.current = true
                  } catch (e) {
                    // Игнорируем ошибки, если карта еще не готова
                  }
                }
              }, 200)
            }
          }
        } catch (e) {
          // Игнорируем ошибки
        }
      }
    }
  }, [map, trackPoints, currentLocation])
  
  if (trackPoints.length === 0) {
    return null
  }
  
  return (
    <Polyline
      positions={trackPoints.map(p => [p.lat, p.lon] as L.LatLngExpression)}
      color="#3b82f6"
      weight={4}
      opacity={0.7}
    />
  )
}

export function DriverLocationMap({
  driverId,
  orderId,
  height = '400px',
  zoom = 15,
  showUserLocation = false,
  showTrack = true,
  trackDate = new Date(),
}: DriverLocationMapProps) {
  const supabase = createClient()
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [trackPoints, setTrackPoints] = useState<Array<{ lat: number; lon: number }>>([])
  const [loading, setLoading] = useState(true)

  // Парсим координаты из POINT формата
  const parsePoint = (point: any): { lat: number; lon: number } | null => {
    if (!point) return null

    try {
      // Если это уже объект с lat и lon
      if (typeof point === 'object' && 'lat' in point && 'lon' in point) {
        return { lat: point.lat, lon: point.lon }
      }

      // Если это объект с координатами в массиве (GeoJSON формат)
      if (typeof point === 'object' && 'coordinates' in point && Array.isArray(point.coordinates)) {
        return { lat: point.coordinates[1], lon: point.coordinates[0] }
      }

      // Если это строка в формате "(lon,lat)"
      if (typeof point === 'string') {
        // Пробуем парсить как JSON
        try {
          const parsed = JSON.parse(point)
          if (typeof parsed === 'object' && 'lat' in parsed && 'lon' in parsed) {
            return parsed
          }
        } catch (e) {
          // Не JSON, пробуем парсить как "(lon,lat)"
          const match = point.match(/\(([^,]+),\s*([^)]+)\)/)
          if (match && match.length === 3) {
            return { lat: parseFloat(match[2]), lon: parseFloat(match[1]) }
          }
          // Пробуем парсить как WKT формат "POINT(lon lat)"
          const wktMatch = point.match(/POINT\(([^ ]+) ([^ ]+)\)/)
          if (wktMatch && wktMatch.length === 3) {
            return { lat: parseFloat(wktMatch[2]), lon: parseFloat(wktMatch[1]) }
          }
        }
      }
    } catch (e) {
      console.error('Ошибка парсинга координат:', e, point)
    }

    return null
  }

  // Загружаем трек водителя за день
  useEffect(() => {
    if (!showTrack) {
      return
    }

    const loadTrack = async () => {
      try {
        const dateStr = trackDate.toISOString().split('T')[0] // Формат YYYY-MM-DD
        const { data: trackData, error: trackError } = await supabase
          .rpc('get_driver_track', {
            p_driver_id: driverId,
            p_date: dateStr,
          })

        if (!trackError && trackData && trackData.length > 0) {
          const points = trackData
            .map((point: any) => ({
              lat: parseFloat(point.latitude),
              lon: parseFloat(point.longitude),
            }))
            .filter((p: { lat: number; lon: number }) => !isNaN(p.lat) && !isNaN(p.lon))
          setTrackPoints(points)
        } else if (trackError) {
          console.error('Ошибка загрузки трека:', trackError)
        }
      } catch (err) {
        console.error('Ошибка загрузки трека водителя:', err)
      }
    }

    loadTrack()
  }, [driverId, trackDate, showTrack, supabase])

  useEffect(() => {
    // Загружаем текущее местоположение водителя
    const loadLocation = async () => {
      try {
        // Используем RPC функцию для безопасного получения местоположения
        // Добавляем обработку таймаута
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // Таймаут 10 секунд

        try {
          const { data: locationData, error: rpcError } = await supabase
            .rpc('get_driver_location_for_order', {
              p_driver_id: driverId,
              p_order_id: orderId || null,
            })

          clearTimeout(timeoutId)

          if (!rpcError && locationData && locationData.length > 0) {
            const loc = locationData[0]
            if (loc.latitude && loc.longitude) {
              setLocation({
                lat: parseFloat(loc.latitude),
                lon: parseFloat(loc.longitude),
              })
              setLoading(false)
              return
            }
          }

          // Если RPC функция не вернула данные, логируем ошибку
          if (rpcError) {
            console.error('Ошибка получения местоположения через RPC:', rpcError)
          } else if (!locationData || locationData.length === 0) {
            console.warn('RPC функция не вернула данные о местоположении водителя')
          }
        } catch (timeoutError: any) {
          clearTimeout(timeoutId)
          if (timeoutError.name === 'AbortError') {
            console.warn('Таймаут при получении местоположения водителя')
          } else {
            throw timeoutError
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки местоположения:', err)
      } finally {
        setLoading(false)
      }
    }

    loadLocation()

    // Подписываемся на изменения местоположения через Supabase Realtime
    // Если Realtime недоступен, данные все равно обновляются при загрузке компонента
    const channel = supabase
      .channel(`driver-location-map-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          if (payload.new) {
            const newLocation = payload.new as any
            if (newLocation.latitude && newLocation.longitude) {
              setLocation({
                lat: parseFloat(newLocation.latitude),
                lon: parseFloat(newLocation.longitude),
              })
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${driverId}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).current_location) {
            const coords = parsePoint((payload.new as any).current_location)
            if (coords) {
              setLocation(coords)
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Подписка на обновления местоположения водителя активна')
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('Ошибка подключения к Realtime (не критично, данные обновляются через API)')
        }
      })
    
    // Периодически обновляем местоположение, если Realtime недоступен
    const refreshInterval = setInterval(() => {
      loadLocation()
    }, 30000) // Обновляем каждые 30 секунд

    return () => {
      supabase.removeChannel(channel)
      clearInterval(refreshInterval)
    }
  }, [driverId, orderId, supabase])

  if (loading) {
    return (
      <div style={{ height }} className="rounded-lg overflow-hidden border border-gray-600 bg-gray-700 flex items-center justify-center">
        <p className="text-gray-400">Загрузка карты...</p>
      </div>
    )
  }

  if (!location) {
    return (
      <div style={{ height }} className="rounded-lg overflow-hidden border border-gray-600 bg-gray-700 flex items-center justify-center">
        <p className="text-gray-400">Местоположение водителя недоступно</p>
      </div>
    )
  }

  const center: [number, number] = [location.lat, location.lon]

  // Создаем кастомную иконку для водителя (красный маркер)
  const driverIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  })

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border border-gray-600">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <MapCenter center={center} zoom={zoom} hasTrack={showTrack && trackPoints.length > 0} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Трек водителя за день */}
        {showTrack && trackPoints.length > 0 && (
          <DriverTrack trackPoints={trackPoints} currentLocation={location} />
        )}

        {/* Маркер местоположения водителя */}
        <Marker position={[location.lat, location.lon]} icon={driverIcon}>
          <Popup>
            <div className="text-sm">
              <strong>Местоположение водителя</strong>
              <div className="mt-1 text-xs text-gray-600">
                Широта: {location.lat.toFixed(6)}
                <br />
                Долгота: {location.lon.toFixed(6)}
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}

