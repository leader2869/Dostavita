'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Исправление иконок по умолчанию для Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface OrderMapProps {
  pickupCoordinates?: { lat: number; lon: number }
  deliveryCoordinates?: { lat: number; lon: number }
  driverCoordinates?: { lat: number; lon: number }
  height?: string
  showRoute?: boolean
  zoom?: number
}

// Компонент для автоматического изменения границ карты
function MapBounds({ pickupCoordinates, deliveryCoordinates, driverCoordinates }: {
  pickupCoordinates?: { lat: number; lon: number }
  deliveryCoordinates?: { lat: number; lon: number }
  driverCoordinates?: { lat: number; lon: number }
}) {
  const map = useMap()

  useEffect(() => {
    const bounds: L.LatLngExpression[] = []
    
    if (pickupCoordinates) {
      bounds.push([pickupCoordinates.lat, pickupCoordinates.lon])
    }
    if (deliveryCoordinates) {
      bounds.push([deliveryCoordinates.lat, deliveryCoordinates.lon])
    }
    if (driverCoordinates) {
      bounds.push([driverCoordinates.lat, driverCoordinates.lon])
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [map, pickupCoordinates, deliveryCoordinates, driverCoordinates])

  return null
}

// Компонент для построения маршрута
function RouteLine({ pickupCoordinates, deliveryCoordinates }: {
  pickupCoordinates?: { lat: number; lon: number }
  deliveryCoordinates?: { lat: number; lon: number }
}) {
  const map = useMap()
  const routeRef = useRef<L.Polyline | null>(null)

  useEffect(() => {
    if (!pickupCoordinates || !deliveryCoordinates) {
      if (routeRef.current) {
        map.removeLayer(routeRef.current)
        routeRef.current = null
      }
      return
    }

    // Используем OSRM для построения маршрута
    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickupCoordinates.lon},${pickupCoordinates.lat};${deliveryCoordinates.lon},${deliveryCoordinates.lat}?overview=full&geometries=geojson`
        )
        const data = await response.json()

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0]
          const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])

          if (routeRef.current) {
            map.removeLayer(routeRef.current)
          }

          routeRef.current = L.polyline(coordinates as L.LatLngExpression[], {
            color: '#10b981',
            weight: 4,
            opacity: 0.7,
          }).addTo(map)

          // Обновляем границы карты с учетом маршрута
          map.fitBounds(routeRef.current.getBounds(), { padding: [50, 50] })
        }
      } catch (error) {
        console.error('Ошибка построения маршрута:', error)
      }
    }

    fetchRoute()

    return () => {
      if (routeRef.current) {
        map.removeLayer(routeRef.current)
        routeRef.current = null
      }
    }
  }, [map, pickupCoordinates, deliveryCoordinates])

  return null
}

export function OrderMap({
  pickupCoordinates,
  deliveryCoordinates,
  driverCoordinates,
  height = '400px',
  showRoute = true,
  zoom = 13,
}: OrderMapProps) {
  // Определяем центр карты
  const center: [number, number] = pickupCoordinates
    ? [pickupCoordinates.lat, pickupCoordinates.lon]
    : deliveryCoordinates
    ? [deliveryCoordinates.lat, deliveryCoordinates.lon]
    : [53.9, 27.5667] // Минск по умолчанию

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Автоматическое изменение границ */}
        <MapBounds
          pickupCoordinates={pickupCoordinates}
          deliveryCoordinates={deliveryCoordinates}
          driverCoordinates={driverCoordinates}
        />

        {/* Построение маршрута */}
        {showRoute && (
          <RouteLine
            pickupCoordinates={pickupCoordinates}
            deliveryCoordinates={deliveryCoordinates}
          />
        )}

        {/* Маркер адреса отправления (точка А) */}
        {pickupCoordinates && (
          <Marker
            position={[pickupCoordinates.lat, pickupCoordinates.lon]}
            icon={L.divIcon({
              className: 'custom-marker-pickup',
              html: `<div style="background-color: #3b82f6; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">А</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            })}
          >
            <Popup>
              <div className="text-sm">
                <strong>Точка А: Адрес отправления</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Маркер адреса доставки (точка Б) */}
        {deliveryCoordinates && (
          <Marker
            position={[deliveryCoordinates.lat, deliveryCoordinates.lon]}
            icon={L.divIcon({
              className: 'custom-marker-delivery',
              html: `<div style="background-color: #10b981; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Б</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            })}
          >
            <Popup>
              <div className="text-sm">
                <strong>Точка Б: Адрес доставки</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Маркер местоположения курьера (статический, если передан) */}
        {driverCoordinates && (
          <Marker
            position={[driverCoordinates.lat, driverCoordinates.lon]}
            icon={L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            })}
          >
            <Popup>
              <div className="text-sm">
                <strong>Местоположение курьера</strong>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}

