'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Исправление иконок по умолчанию для Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface AddressPickerMapProps {
  onSelect: (coordinates: { lat: number; lon: number }) => void
  initialCoordinates?: { lat: number; lon: number }
  height?: string
  label?: string
}

// Компонент для обработки кликов на карте
function MapClickHandler({ onSelect }: { onSelect: (coordinates: { lat: number; lon: number }) => void }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng
      onSelect({ lat, lon: lng })
    },
  })
  return null
}

export function AddressPickerMap({
  onSelect,
  initialCoordinates,
  height = '400px',
  label = 'Выберите точку на карте',
}: AddressPickerMapProps) {
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lon: number } | null>(
    initialCoordinates || null
  )

  const center: [number, number] = initialCoordinates
    ? [initialCoordinates.lat, initialCoordinates.lon]
    : [53.9, 27.5667] // Минск по умолчанию

  const handleMapClick = (coordinates: { lat: number; lon: number }) => {
    setSelectedCoordinates(coordinates)
    onSelect(coordinates)
  }

  // Обратный геокодинг для получения адреса по координатам
  const [address, setAddress] = useState<string>('')

  useEffect(() => {
    if (selectedCoordinates) {
      // Используем Nominatim для обратного геокодинга
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedCoordinates.lat}&lon=${selectedCoordinates.lon}&zoom=18&addressdetails=1`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data && data.display_name) {
            // Форматируем адрес: убираем район и почтовый индекс
            const parts = data.display_name.split(',')
            const filteredParts = parts.filter(
              (part: string) =>
                !part.includes('район') &&
                !part.includes('Район') &&
                !/\d{6}/.test(part.trim()) // Убираем почтовые индексы
            )
            setAddress(filteredParts.join(',').trim())
          }
        })
        .catch((error) => {
          console.error('Ошибка геокодинга:', error)
          setAddress('')
        })
    }
  }, [selectedCoordinates])

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border border-gray-600">
      <div className="bg-gray-800 p-2 text-sm text-gray-300 text-center border-b border-gray-700">
        {label}
      </div>
      <MapContainer
        center={center}
        zoom={initialCoordinates ? 15 : 11}
        style={{ height: 'calc(100% - 40px)', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onSelect={handleMapClick} />

        {/* Маркер выбранной точки */}
        {selectedCoordinates && (
          <Marker
            position={[selectedCoordinates.lat, selectedCoordinates.lon]}
            icon={L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
            })}
          >
            <Popup>
              <div className="text-sm">
                <strong>Выбранная точка</strong>
                {address && (
                  <div className="mt-1 text-xs text-gray-600">
                    {address}
                  </div>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  {selectedCoordinates.lat.toFixed(6)}, {selectedCoordinates.lon.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      {selectedCoordinates && address && (
        <div className="bg-gray-700 p-2 text-xs text-gray-300 border-t border-gray-600">
          <strong>Адрес:</strong> {address}
        </div>
      )}
    </div>
  )
}

