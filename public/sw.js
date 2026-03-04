// Service Worker для обработки push-уведомлений
// Не кэшируем чанки Next.js (/_next/), чтобы после деплоя не было 404 на main-app.js, layout.js и т.д.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Запросы к _next и прочим скриптам — только сеть, без кэша (избегаем 404 после новой сборки)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/_next/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(fetch(event.request))
    return
  }
})

self.addEventListener('push', (event) => {
  console.log('Получено push-уведомление:', event)
  
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Новый заказ'
  const options = {
    body: data.body || 'У вас есть новый доступный заказ',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: data.tag || 'new-order',
    data: data.data || {},
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'Посмотреть',
      },
      {
        action: 'close',
        title: 'Закрыть',
      },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

self.addEventListener('notificationclick', (event) => {
  console.log('Клик по уведомлению:', event)
  
  event.notification.close()

  if (event.action === 'view' || !event.action) {
    // Открываем приложение
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Если есть открытое окно, фокусируемся на нем
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus()
          }
        }
        // Если нет открытого окна, открываем новое
        if (self.clients.openWindow) {
          return self.clients.openWindow('/dashboard/driver')
        }
      })
    )
  }
})

