'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { readyPushRegistration, removeDevicePushSubscription, saveDevicePushSubscription, vapidBytes } from '@/lib/browser-push'

export function usePushNotifications(userId: string) {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    let active = true
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setIsSupported(supported)
    setIsSubscribed(false)
    if (supported && Notification.permission === 'granted') {
      void (async () => {
        try {
          const registration = await readyPushRegistration()
          const existing = await registration.pushManager.getSubscription()
          if (existing) {
            await saveDevicePushSubscription(existing)
            if (active) setIsSubscribed(true)
          }
        } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Не удалось проверить уведомления') }
      })()
    }
    return () => { active = false }
  }, [userId])

  const subscribe = useCallback(async () => {
    if (!isSupported || busy.current) return false
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) { setError('Отправка уведомлений пока не настроена'); return false }
    busy.current = true
    setIsBusy(true)
    setError(null)
    setIsSubscribed(false)
    try {
      // Keep the permission request in the button's user gesture (required on mobile).
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Разрешите уведомления для сайта в настройках браузера')
      const registration = await readyPushRegistration()
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: vapidBytes(vapidKey),
      })
      await saveDevicePushSubscription(subscription)
      setIsSubscribed(true)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось включить уведомления')
      return false
    } finally { busy.current = false; setIsBusy(false) }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    if (busy.current) return false
    busy.current = true
    setIsBusy(true)
    setError(null)
    try { await removeDevicePushSubscription(); return true }
    catch (err) { setError(err instanceof Error ? err.message : 'Не удалось отключить уведомления'); return false }
    finally { setIsSubscribed(false); busy.current = false; setIsBusy(false) }
  }, [])

  return { isSupported, isSubscribed, isBusy, error, subscribe, unsubscribe }
}
