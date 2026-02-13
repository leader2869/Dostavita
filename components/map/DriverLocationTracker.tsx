'use client'

import { useEffect, useState, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { createClient } from '@/lib/supabase/client'

interface DriverLocationTrackerProps {
  driverId: string
  orderId?: string
}

export function DriverLocationTracker({ driverId, orderId }: DriverLocationTrackerProps) {
  const map = useMap()
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Создаем кастомную иконку для курьера
    const driverIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [30, 46],
      iconAnchor: [15, 46],
      popupAnchor: [1, -34],
      shadowSize: [46, 46],
    })

    // Подписываемся на изменения местоположения курьера через Supabase Realtime
    const channel = supabase
      .channel(`driver-location:${driverId}`)
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
              const coords = {
                lat: parseFloat(newLocation.latitude),
                lon: parseFloat(newLocation.longitude),
              }
              setLocation(coords)

              // Обновляем или создаем маркер
              if (markerRef.current) {
                markerRef.current.setLatLng([coords.lat, coords.lon])
              } else {
                markerRef.current = L.marker([coords.lat, coords.lon], { icon: driverIcon })
                  .addTo(map)
                  .bindPopup('Местоположение курьера')
              }

              // Центрируем карту на местоположении курьера
              map.setView([coords.lat, coords.lon], map.getZoom(), { animate: true })
            }
          }
        }
      )
      .subscribe()

    // Загружаем текущее местоположение
    const loadCurrentLocation = async () => {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('latitude, longitude, updated_at')
        .eq('driver_id', driverId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data && data.latitude && data.longitude) {
        const coords = {
          lat: parseFloat(data.latitude),
          lon: parseFloat(data.longitude),
        }
        setLocation(coords)

        if (markerRef.current) {
          markerRef.current.setLatLng([coords.lat, coords.lon])
        } else {
          markerRef.current = L.marker([coords.lat, coords.lon], { icon: driverIcon })
            .addTo(map)
            .bindPopup('Местоположение курьера')
        }
      }
    }

    loadCurrentLocation()

    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
        markerRef.current = null
      }
      supabase.removeChannel(channel)
    }
  }, [map, driverId, supabase, orderId])

  return null
}

