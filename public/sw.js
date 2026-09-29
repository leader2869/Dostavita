// Push delivery only. Next.js assets are intentionally not cached.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() || {} } catch { /* Keep a readable fallback for malformed payloads. */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Dostavita — новый заказ', {
    body: data.body || 'У вас есть новый доступный заказ',
    icon: '/icon-192x192.png?v=dostavita-2',
    badge: '/icon-192x192.png?v=dostavita-2',
    tag: data.tag || 'new-order',
    data: data.data || {},
    requireInteraction: true,
    actions: [{ action: 'view', title: 'Посмотреть' }, { action: 'close', title: 'Закрыть' }],
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  if (event.action === 'close') return
  let target = new URL('/dashboard/driver', self.location.origin)
  try {
    const requested = new URL(event.notification.data?.url || target.href, self.location.origin)
    if (requested.origin === self.location.origin && requested.pathname.startsWith('/dashboard')) target = requested
  } catch { /* Ignore malformed/external destinations. */ }
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = clients.find(client => client.url === target.href)
      || clients.find(client => new URL(client.url).origin === self.location.origin)
    if (existing) {
      try {
        const navigated = existing.url === target.href ? existing : await existing.navigate(target.href)
        if (navigated) return await navigated.focus()
      } catch { /* A tab may close between matchAll and navigate. */ }
    }
    return self.clients.openWindow(target.href)
  })())
})
