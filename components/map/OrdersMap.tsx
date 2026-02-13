'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { useGeolocation } from '@/hooks/useGeolocation'

// Исправление иконок по умолчанию для Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface Order {
  id: string
  pickup_address: string
  delivery_address: string
  pickup_coordinates?: { lat: number; lon: number } | string
  delivery_coordinates?: { lat: number; lon: number } | string
  status: string
  item_type?: string
  final_price?: number
}

interface OrdersMapProps {
  orders: Order[]
  height?: string
  zoom?: number
  role?: 'client' | 'driver' | 'customer'
}

// Компонент для автоматического изменения границ карты
function MapBounds({ orders, userLocation }: { orders: Order[], userLocation?: { lat: number; lon: number } | null }) {
  const map = useMap()

  useEffect(() => {
    const bounds: [number, number][] = []

    orders.forEach((order) => {
      if (order.pickup_coordinates) {
        const coords = typeof order.pickup_coordinates === 'string'
          ? JSON.parse(order.pickup_coordinates)
          : order.pickup_coordinates
        if (coords && coords.lat && coords.lon) {
          bounds.push([coords.lat, coords.lon])
        }
      }
      if (order.delivery_coordinates) {
        const coords = typeof order.delivery_coordinates === 'string'
          ? JSON.parse(order.delivery_coordinates)
          : order.delivery_coordinates
        if (coords && coords.lat && coords.lon) {
          bounds.push([coords.lat, coords.lon])
        }
      }
    })

    // Если нет заказов, но есть местоположение пользователя, центрируем на нем
    if (bounds.length === 0 && userLocation) {
      map.setView([userLocation.lat, userLocation.lon], map.getZoom())
      return
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] })
    }
  }, [map, orders, userLocation])

  return null
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'searching_courier':
      return '#fbbf24' // желтый
    case 'courier_coming':
      return '#3b82f6' // синий
    case 'courier_delivering':
      return '#8b5cf6' // фиолетовый
    case 'completed':
      return '#10b981' // зеленый
    case 'cancelled':
      return '#ef4444' // красный
    default:
      return '#6b7280' // серый
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'searching_courier':
      return 'Ищем курьера'
    case 'courier_coming':
      return 'Курьер едет'
    case 'courier_delivering':
      return 'Доставляется'
    case 'completed':
      return 'Завершен'
    case 'cancelled':
      return 'Отменен'
    default:
      return status
  }
}

export function OrdersMap({ orders, height = '600px', zoom = 11, role = 'client' }: OrdersMapProps) {
  const { coordinates: userLocation } = useGeolocation()
  
  // Используем местоположение пользователя, если доступно, иначе Минск
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lon]
    : [53.9, 27.5667] // Минск по умолчанию

  const getOrderUrl = (orderId: string) => {
    if (role === 'client') {
      return `/dashboard/client/orders/${orderId}`
    } else if (role === 'driver') {
      return `/dashboard/driver/orders/${orderId}`
    } else if (role === 'customer') {
      return `/dashboard/customer/orders/${orderId}`
    }
    return '#'
  }

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border border-gray-700">
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

        <MapBounds orders={orders} userLocation={userLocation} />

        {/* Маркер текущего местоположения пользователя */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lon]}
            icon={L.divIcon({
              className: 'custom-marker-user-location',
              html: `<div style="background-color: #8b5cf6; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">📍</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            })}
          >
            <Popup>
              <div className="text-sm">
                <strong>Ваше местоположение</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {orders.map((order) => {
          // Обрабатываем координаты отправления
          let pickupCoords: { lat: number; lon: number } | null = null
          if (order.pickup_coordinates) {
            try {
              pickupCoords = typeof order.pickup_coordinates === 'string'
                ? JSON.parse(order.pickup_coordinates)
                : order.pickup_coordinates
            } catch (e) {
              console.error('Ошибка парсинга координат отправления:', e)
            }
          }

          // Обрабатываем координаты доставки
          let deliveryCoords: { lat: number; lon: number } | null = null
          if (order.delivery_coordinates) {
            try {
              deliveryCoords = typeof order.delivery_coordinates === 'string'
                ? JSON.parse(order.delivery_coordinates)
                : order.delivery_coordinates
            } catch (e) {
              console.error('Ошибка парсинга координат доставки:', e)
            }
          }

          const statusColor = getStatusColor(order.status)

          return (
            <div key={order.id}>
              {/* Маркер адреса отправления */}
              {pickupCoords && pickupCoords.lat && pickupCoords.lon && (
                <Marker
                  position={[pickupCoords.lat, pickupCoords.lon]}
                  icon={L.icon({
                    iconUrl: `data:image/svg+xml;base64,${btoa(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
                        <path fill="${statusColor}" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.8 12.5 28.5 12.5 28.5S25 21.3 25 12.5C25 5.6 19.4 0 12.5 0zm0 17c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z"/>
                      </svg>
                    `)}`,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                  })}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold mb-1">Отправление</div>
                      <div className="mb-2">{order.pickup_address}</div>
                      <div className="mb-2">
                        <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      {order.final_price && (
                        <div className="mb-2 font-semibold">{order.final_price} BYN</div>
                      )}
                      <Link
                        href={getOrderUrl(order.id)}
                        className="text-blue-500 hover:text-blue-700 underline text-xs"
                      >
                        Подробнее
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Маркер адреса доставки */}
              {deliveryCoords && deliveryCoords.lat && deliveryCoords.lon && (
                <Marker
                  position={[deliveryCoords.lat, deliveryCoords.lon]}
                  icon={L.icon({
                    iconUrl: `data:image/svg+xml;base64,${btoa(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
                        <path fill="${statusColor}" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.8 12.5 28.5 12.5 28.5S25 21.3 25 12.5C25 5.6 19.4 0 12.5 0zm0 17c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z"/>
                      </svg>
                    `)}`,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                  })}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold mb-1">Доставка</div>
                      <div className="mb-2">{order.delivery_address}</div>
                      <div className="mb-2">
                        <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      {order.final_price && (
                        <div className="mb-2 font-semibold">{order.final_price} BYN</div>
                      )}
                      <Link
                        href={getOrderUrl(order.id)}
                        className="text-blue-500 hover:text-blue-700 underline text-xs"
                      >
                        Подробнее
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              )}
            </div>
          )
        })}
      </MapContainer>
    </div>
  )
}

