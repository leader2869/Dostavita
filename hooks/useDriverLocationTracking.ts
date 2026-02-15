'use client'

import { useEffect, useRef, useState } from 'react'

interface UseDriverLocationTrackingOptions {
  enabled?: boolean
  interval?: number // Интервал обновления в миллисекундах (по умолчанию 1 минута)
  orderId?: string | null
}

/**
 * Хук для постоянного отслеживания местоположения водителя
 * Водитель всегда передает свое местоположение
 */
export function useDriverLocationTracking({
  enabled = true,
  interval = 60000, // 1 минута (60000 мс) по умолчанию
  orderId = null,
}: UseDriverLocationTrackingOptions = {}) {
  const [isTracking, setIsTracking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let isMounted = true
    
    console.log('useDriverLocationTracking: enabled =', enabled, 'orderId =', orderId)
    
    if (!enabled) {
      console.log('Отслеживание местоположения отключено')
      return
    }

    if (!navigator.geolocation) {
      const errorMsg = 'Геолокация не поддерживается вашим браузером'
      console.error(errorMsg)
      if (isMounted) {
        setError(errorMsg)
      }
      return
    }

    const updateLocation = async (position: GeolocationPosition) => {
      if (!isMounted) return
      
      try {
        console.log('Отправка местоположения:', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          orderId,
        })

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

        if (!isMounted) return

        if (!response.ok) {
          const data = await response.json()
          console.error('Ошибка ответа API:', response.status, data)
          throw new Error(data.error || 'Ошибка обновления местоположения')
        }

        const result = await response.json()
        console.log('Местоположение успешно отправлено:', result)
        if (isMounted) {
          setError(null)
        }
      } catch (err: any) {
        if (!isMounted) return
        console.error('Ошибка обновления местоположения:', err)
        setError(err.message || 'Ошибка обновления местоположения')
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      if (!isMounted) return
      
      let errorMessage = 'Не удалось получить местоположение'
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Доступ к геолокации запрещен. Разрешите доступ в настройках браузера.'
          setIsTracking(false) // Останавливаем отслеживание только при отказе в доступе
          break
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Информация о местоположении недоступна. Проверьте настройки GPS.'
          // Не останавливаем отслеживание, продолжаем попытки
          break
        case error.TIMEOUT:
          errorMessage = 'Превышено время ожидания. Продолжаем попытки...'
          // Не останавливаем отслеживание при таймауте, продолжаем попытки
          console.warn('Таймаут получения местоположения, продолжаем попытки')
          break
      }
      setError(errorMessage)
      // Не останавливаем отслеживание при временных ошибках
    }

    // Начинаем отслеживание местоположения
    const startTracking = () => {
      // Используем более мягкие настройки для надежности
      const options: PositionOptions = {
        enableHighAccuracy: false, // Отключаем высокую точность для более быстрого получения
        timeout: 15000, // Увеличиваем таймаут до 15 секунд
        maximumAge: 60000, // Разрешаем использовать кэшированное местоположение до 1 минуты
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
    // Используем более мягкие настройки для первоначального запроса
    navigator.geolocation.getCurrentPosition(
      () => {
        // Разрешение получено, начинаем отслеживание
        startTracking()
      },
      handleError,
      { 
        enableHighAccuracy: false, // Отключаем высокую точность для более быстрого получения
        timeout: 15000, // Увеличиваем таймаут до 15 секунд
        maximumAge: 60000, // Разрешаем использовать кэшированное местоположение
      }
    )

    // Очистка при размонтировании
    return () => {
      isMounted = false
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Не вызываем setIsTracking(false) здесь, так как компонент уже размонтирован
    }
  }, [enabled, interval, orderId])

  return {
    isTracking,
    error,
  }
}

