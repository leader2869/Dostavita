# Настройка VAPID ключей для Push-уведомлений

VAPID (Voluntary Application Server Identification) ключи необходимы для полноценной работы push-уведомлений. Они позволяют серверу отправлять уведомления даже когда приложение закрыто.

## Шаг 1: Установка зависимостей

Установите библиотеку `web-push` для генерации ключей:

```bash
npm install web-push
```

## Шаг 2: Генерация VAPID ключей

Запустите скрипт для генерации ключей:

```bash
npm run generate-vapid-keys
```

Или напрямую:

```bash
node scripts/generate-vapid-keys.js
```

Скрипт выведет два ключа:
- **Публичный ключ** (Public Key) - используется на клиенте
- **Приватный ключ** (Private Key) - используется на сервере

## Шаг 3: Добавление ключей в переменные окружения

Добавьте сгенерированные ключи в файл `.env.local`:

```env
# VAPID ключи для push-уведомлений
NEXT_PUBLIC_VAPID_PUBLIC_KEY=ваш_публичный_ключ_здесь
VAPID_PRIVATE_KEY=ваш_приватный_ключ_здесь
```

**⚠️ ВАЖНО:**
- НЕ коммитьте файл `.env.local` в Git (он уже в `.gitignore`)
- НЕ публикуйте приватный ключ в открытом доступе
- Используйте разные ключи для разработки и продакшена

## Шаг 4: Перезапуск сервера

После добавления переменных окружения перезапустите сервер разработки:

```bash
npm run dev
```

## Шаг 5: Проверка работы

1. Откройте приложение в браузере
2. Войдите как водитель
3. При первом клике на странице должно появиться окно с запросом разрешения на уведомления
4. После разрешения в консоли браузера должно появиться сообщение об успешной подписке

## Использование на сервере (для отправки уведомлений)

Если вы хотите отправлять push-уведомления с сервера (например, через API endpoint), используйте библиотеку `web-push`:

```typescript
import webpush from 'web-push'

// Настройка VAPID деталей
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Контактный email
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// Отправка уведомления
const subscription = {
  endpoint: '...',
  keys: {
    p256dh: '...',
    auth: '...'
  }
}

await webpush.sendNotification(
  subscription,
  JSON.stringify({
    title: 'Новый заказ!',
    body: 'У вас есть новый доступный заказ',
    icon: '/icon-192x192.png'
  })
)
```

## Альтернативный способ генерации (без npm скрипта)

Если у вас установлен `web-push` глобально:

```bash
npx web-push generate-vapid-keys
```

Или через Node.js напрямую:

```javascript
const webpush = require('web-push')
const vapidKeys = webpush.generateVAPIDKeys()
console.log('Public Key:', vapidKeys.publicKey)
console.log('Private Key:', vapidKeys.privateKey)
```

## Troubleshooting

### Ошибка: "VAPID ключ не настроен"
- Убедитесь, что переменные окружения добавлены в `.env.local`
- Перезапустите сервер разработки после добавления переменных
- Проверьте, что ключи скопированы полностью (без пробелов в начале/конце)

### Уведомления не приходят
- Проверьте, что разрешение на уведомления предоставлено в браузере
- Убедитесь, что Service Worker зарегистрирован (проверьте в DevTools > Application > Service Workers)
- Проверьте консоль браузера на наличие ошибок

### Ошибка при генерации ключей
- Убедитесь, что `web-push` установлен: `npm install web-push`
- Попробуйте установить глобально: `npm install -g web-push`

