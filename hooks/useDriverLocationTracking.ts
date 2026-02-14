'use client'

import { useEffect, useRef, useState } from 'react'

interface UseDriverLocationTrackingOptions {
  enabled?: boolean
  interval?: number // Интервал обновления в миллисекундах (по умолчанию 10 секунд)
  orderId?: string | null
}

/**
 * Хук для постоянного отслеживания местоположения водителя при активных заказах
 */
export function useDriverLocationTracking({
  enabled = true,
  interval = 10000, // 10 секунд по умолчанию
  orderId = null,
}: UseDriverLocationTrackingOptions = {}) {
  const [isTracking, setIsTracking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (!navigator.geolocation) {
      setError('Геолокация не поддерживается вашим браузером')
      return
    }

    const updateLocation = async (position: GeolocationPosition) => {
      try {
        const response = await fetch('/api/driver/update-location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading || null,
            speed: position.coords.speed || null,
            order_id: orderId,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Ошибка обновления местоположения')
        }

        setError(null)
      } catch (err: any) {
        console.error('Ошибка обновления местоположения:', err)
        setError(err.message || 'Ошибка обновления местоположения')
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = 'Не удалось получить местоположение'
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Доступ к геолокации запрещен. Разрешите доступ в настройках браузера.'
          break
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Информация о местоположении недоступна'
          break
        case error.TIMEOUT:
          errorMessage = 'Превышено время ожидания запроса местоположения'
          break
      }
      setError(errorMessage)
      setIsTracking(false)
    }

    // Начинаем отслеживание местоположения
    const startTracking = () => {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }

      // Получаем местоположение сразу
      navigator.geolocation.getCurrentPosition(updateLocation, handleError, options)

      // Затем обновляем с заданным интервалом
      intervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(updateLocation, handleError, options)
      }, interval)

      setIsTracking(true)
    }

    // Запрашиваем разрешение и начинаем отслеживание
    navigator.geolocation.getCurrentPosition(
      () => {
        // Разрешение получено, начинаем отслеживание
        startTracking()
      },
      handleError,
      { enableHighAccuracy: true, timeout: 5000 }
    )

    // Очистка при размонтировании
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setIsTracking(false)
    }
  }, [enabled, interval, orderId])

  return {
    isTracking,
    error,
  }
}

