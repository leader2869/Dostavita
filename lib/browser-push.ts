'use client'

export async function withPushTimeout<T>(work: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([Promise.resolve(work), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Не удалось подключить уведомления. Проверьте сеть и повторите.')), 15000)
    })])
  } finally { if (timer) clearTimeout(timer) }
}

export async function readyPushRegistration() {
  await withPushTimeout(navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }))
  return withPushTimeout(navigator.serviceWorker.ready)
}

export function vapidBytes(value: string): BufferSource {
  const base64 = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer
}

export async function saveDevicePushSubscription(subscription: PushSubscription) {
  const data = subscription.toJSON()
  const response = await withPushTimeout(fetch('/api/push/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: { endpoint: subscription.endpoint, keys: data.keys } }),
  }))
  if (response.status === 409) {
    // A shared browser switched accounts. Revoke the previous endpoint before retrying.
    await subscription.unsubscribe()
    throw new Error('Включите уведомления ещё раз для текущего аккаунта.')
  }
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    const code = result?.error?.code
    if (['PUSH_INVALID_SUBSCRIPTION', 'PUSH_UNSUPPORTED_PROVIDER'].includes(code)) {
      throw new Error(result.error.message)
    }
    if (response.status === 401) throw new Error('Сессия истекла. Войдите в аккаунт заново и включите уведомления.')
    throw new Error('Сервер не смог сохранить подписку. Повторите попытку позже.')
  }
}

/** Removes this browser only. Also used before logout while its session is valid. */
export async function removeDevicePushSubscription() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  try {
    const response = await withPushTimeout(fetch('/api/push/unregister', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }))
    if (!response.ok) throw new Error('Не удалось удалить подписку с сервера')
  } finally {
    // Prevent notifications for the previous account even if the server is offline.
    await subscription.unsubscribe()
  }
}
