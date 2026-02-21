# Инструкция по деплою на Vercel

## 📋 Подготовка проекта

### 1. Обновить next.config.js для production

Нужно обновить настройки изображений для работы на Vercel:

```javascript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '**',
    },
  ],
},
```

Или можно оставить как есть, если изображения только из Supabase Storage.

## 🚀 Деплой на Vercel

### Шаг 1: Создать аккаунт на Vercel

1. Перейдите на https://vercel.com
2. Нажмите "Sign Up"
3. Выберите "Continue with GitHub"
4. Авторизуйтесь через GitHub

### Шаг 2: Импортировать проект

1. В Dashboard Vercel нажмите "Add New..." → "Project"
2. Найдите репозиторий `leader2869/Dostavita`
3. Нажмите "Import"

### Шаг 3: Настройка проекта

**Framework Preset:** Next.js (должен определиться автоматически)

**Root Directory:** `./` (оставьте по умолчанию)

**Build Command:** `npm run build` (по умолчанию)

**Output Directory:** `.next` (по умолчанию)

**Install Command:** `npm install` (по умолчанию)

### Шаг 4: Настроить переменные окружения

В разделе "Environment Variables" добавьте:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

**Важно:** 
- Замените `your_supabase_url` и `your_supabase_anon_key` на реальные значения из `.env.local`
- `NEXT_PUBLIC_APP_URL` будет автоматически обновлен после подключения домена

### Шаг 5: Деплой

1. Нажмите "Deploy"
2. Дождитесь завершения сборки (обычно 2-5 минут)
3. После успешного деплоя вы получите URL вида: `https://dostavita-xxx.vercel.app`

## 🌐 Подключение домена

### Шаг 1: Добавить домен в Vercel

1. В настройках проекта перейдите в "Domains"
2. Введите ваш домен (например, `prosto.of.by`)
3. Нажмите "Add"

### Шаг 2: Настроить DNS на Hoster.by

Vercel покажет вам DNS записи, которые нужно добавить:

**Вариант 1: Поддомен (рекомендуется)**
- Тип: `CNAME`
- Имя: `www` (или `app`, или оставьте пустым для корневого домена)
- Значение: `cname.vercel-dns.com`

**Вариант 2: Корневой домен**
- Тип: `A`
- Имя: `@` (или пустое)
- Значение: IP адрес от Vercel (будет показан в настройках)

### Шаг 3: Ожидание

DNS изменения могут занять до 24 часов, обычно 1-2 часа.

## ✅ Проверка после деплоя

1. Откройте ваш домен в браузере
2. Проверьте авторизацию
3. Проверьте работу всех функций
4. Проверьте работу карт (Leaflet)
5. Проверьте работу Realtime (Supabase)

## 🔄 Автоматический деплой

После первого деплоя Vercel автоматически будет деплоить проект при каждом push в ветку `main` на GitHub.

## 📝 Важные замечания

1. **Supabase CORS:** Убедитесь, что в настройках Supabase добавлен ваш домен в список разрешенных доменов
2. **Environment Variables:** Все переменные с префиксом `NEXT_PUBLIC_` должны быть добавлены в Vercel
3. **Build Errors:** Если есть ошибки сборки, проверьте логи в Vercel Dashboard

## 🆘 Решение проблем

### Ошибка сборки
- Проверьте логи в Vercel Dashboard
- Убедитесь, что все зависимости установлены
- Проверьте, что нет ошибок TypeScript

### Проблемы с изображениями
- Обновите `next.config.js` с `remotePatterns` для Supabase Storage

### Проблемы с CORS
- Добавьте домен Vercel в настройки Supabase
- Проверьте настройки CORS в Supabase Dashboard

## 📊 Мониторинг

Vercel предоставляет:
- Analytics (на платном тарифе)
- Логи в реальном времени
- Метрики производительности

## 💰 Тарифы Vercel

**Hobby (Бесплатный):**
- 100 GB bandwidth в месяц
- Unlimited requests
- Подходит для 50-100 пользователей в день

**Pro ($20/месяц):**
- 1 TB bandwidth
- Advanced analytics
- Team collaboration

Для вашего проекта бесплатный тариф должен быть достаточным.

