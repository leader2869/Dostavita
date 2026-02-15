'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Проверяем поддержку push-уведомлений
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      setIsSupported(true)
      checkSubscription()
    }
  }, [])

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
      setIsSubscribed(!!sub)
    } catch (error) {
      console.error('Ошибка проверки подписки:', error)
    }
  }

  const subscribe = async () => {
    if (!isSupported) {
      console.warn('Push-уведомления не поддерживаются')
      return false
    }

    try {
      // Регистрируем Service Worker
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Запрашиваем разрешение
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        console.warn('Разрешение на уведомления не предоставлено')
        return false
      }

      // Создаем подписку
      // Если VAPID ключ не настроен, используем стандартную подписку
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      const subscribeOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      }
      
      if (vapidKey) {
        subscribeOptions.applicationServerKey = urlBase64ToUint8Array(vapidKey)
      }

      const sub = await registration.pushManager.subscribe(subscribeOptions)

      setSubscription(sub)
      setIsSubscribed(true)

      // Отправляем подписку на сервер
      const subscriptionData: PushSubscriptionData = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(sub.getKey('p256dh')!),
          auth: arrayBufferToBase64(sub.getKey('auth')!),
        },
      }

      const response = await fetch('/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscription: subscriptionData }),
      })

      if (!response.ok) {
        throw new Error('Ошибка регистрации подписки на сервере')
      }

      return true
    } catch (error) {
      console.error('Ошибка подписки на push-уведомления:', error)
      return false
    }
  }

  const unsubscribe = async () => {
    if (!subscription) return false

    try {
      await subscription.unsubscribe()
      setSubscription(null)
      setIsSubscribed(false)

      // Удаляем подписку с сервера
      await fetch('/api/push/unregister', {
        method: 'POST',
      })

      return true
    } catch (error) {
      console.error('Ошибка отписки от push-уведомлений:', error)
      return false
    }
  }

  return {
    isSupported,
    isSubscribed,
    subscribe,
    unsubscribe,
  }
}

// Вспомогательные функции
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

