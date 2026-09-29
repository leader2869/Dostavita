'use client'

import { useEffect, useState } from 'react'
import { startLocationTracker } from '@/lib/location-tracker'

interface UseDriverLocationTrackingOptions {
  enabled?: boolean
  interval?: number
  orderId?: string | null
}

export function useDriverLocationTracking({ enabled = true, interval = 60000, orderId = null }: UseDriverLocationTrackingOptions = {}) {
  const [isTracking, setIsTracking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setIsTracking(false)
    setError(null)
    if (!enabled) return
    if (!navigator.geolocation) { setError('Геолокация не поддерживается вашим браузером'); return }
    return startLocationTracker({ orderId, interval, onTracking: setIsTracking, onError: setError }, {
      geolocation: navigator.geolocation,
      network: window, visibility: document,
      isOnline: () => navigator.onLine,
      isVisible: () => document.visibilityState === 'visible',
      fetch: (input, init) => fetch(input, init),
      // Browser timers require Window as their receiver, not the tracker environment.
      every: (handler, timeout) => window.setInterval(handler, timeout),
      cancelEvery: id => window.clearInterval(id),
      later: (handler, timeout) => window.setTimeout(handler, timeout),
      cancelLater: id => window.clearTimeout(id),
    })
  }, [enabled, interval, orderId])
  return { isTracking, error }
}
