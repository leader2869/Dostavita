'use client'

import { useState, useEffect } from 'react'

interface GeolocationState {
  coordinates: { lat: number; lon: number } | null
  loading: boolean
  error: string | null
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({
        coordinates: null,
        loading: false,
        error: 'Геолокация не поддерживается вашим браузером',
      })
      return
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          coordinates: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
          loading: false,
          error: null,
        })
      },
      (error) => {
        let errorMessage = 'Не удалось получить местоположение'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Доступ к геолокации запрещен'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Информация о местоположении недоступна'
            break
          case error.TIMEOUT:
            errorMessage = 'Превышено время ожидания запроса местоположения'
            break
        }
        setState({
          coordinates: null,
          loading: false,
          error: errorMessage,
        })
      },
      options
    )
  }, [])

  return state
}

