'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useGeolocation } from '@/hooks/useGeolocation'

// Исправление иконок по умолчанию для Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface SinglePointMapProps {
  coordinates: { lat: number; lon: number }
  address?: string
  height?: string
  zoom?: number
}

// Компонент для автоматического изменения границ карты
function MapBounds({ coordinates }: { coordinates: { lat: number; lon: number } }) {
  const map = useMap()

  useEffect(() => {
    map.setView([coordinates.lat, coordinates.lon], map.getZoom())
  }, [map, coordinates])

  return null
}

export function SinglePointMap({
  coordinates,
  address,
  height = '300px',
  zoom = 15,
}: SinglePointMapProps) {
  const { coordinates: userLocation } = useGeolocation()
  
  // Используем координаты точки, если они есть, иначе местоположение пользователя
  const center: [number, number] = [coordinates.lat, coordinates.lon]
  
  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border border-gray-600">
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

        <MapBounds coordinates={coordinates} />

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

        {/* Маркер выбранной точки */}
        <Marker
          position={[coordinates.lat, coordinates.lon]}
          icon={L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
          })}
        >
          {address && (
            <Popup>
              <div className="text-sm">
                <strong>Адрес:</strong>
                <div className="mt-1 text-xs text-gray-600">
                  {address}
                </div>
              </div>
            </Popup>
          )}
        </Marker>
      </MapContainer>
    </div>
  )
}

