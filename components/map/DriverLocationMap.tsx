'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
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
}

// Компонент для обновления центра карты
function MapCenter({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap()
  
  useEffect(() => {
    map.setView(center, zoom)
  }, [map, center, zoom])
  
  return null
}

/**
 * Компонент для отображения карты с местоположением водителя
 * Автоматически обновляется через Supabase Realtime
 */
export function DriverLocationMap({
  driverId,
  orderId,
  height = '400px',
  zoom = 15,
  showUserLocation = false,
}: DriverLocationMapProps) {
  const supabase = createClient()
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)
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

  useEffect(() => {
    // Загружаем текущее местоположение водителя
    const loadLocation = async () => {
      try {
        // Сначала пробуем получить из profiles (current_location)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('current_location')
          .eq('id', driverId)
          .single()

        if (!profileError && profileData?.current_location) {
          const coords = parsePoint(profileData.current_location)
          if (coords) {
            setLocation(coords)
            setLoading(false)
            // Не возвращаемся, продолжаем подписку на обновления
          }
        }

        // Также пробуем получить из driver_locations (более точные данные)
        let query = supabase
          .from('driver_locations')
          .select('latitude, longitude')
          .eq('driver_id', driverId)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (orderId) {
          query = query.eq('order_id', orderId)
        }

        const { data: locationData, error: locationError } = await query.single()

        if (!locationError && locationData && locationData.latitude && locationData.longitude) {
          const coords = {
            lat: parseFloat(locationData.latitude),
            lon: parseFloat(locationData.longitude),
          }
          setLocation(coords)
        }
      } catch (err) {
        console.error('Ошибка загрузки местоположения:', err)
      } finally {
        setLoading(false)
      }
    }

    loadLocation()

    // Подписываемся на изменения местоположения через Supabase Realtime
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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
        <MapCenter center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

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

