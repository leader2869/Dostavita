# Dostavita - Платформа для службы доставки

Платформа для службы доставки с поддержкой различных ролей пользователей, управления заказами, исполнителями и автопарками.

## 🚀 Технологии

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Карты**: Mapbox
- **Стили**: Tailwind CSS
- **State Management**: Zustand
- **Валидация**: Zod

## 📋 Предварительные требования

- Node.js 18+ и npm/yarn
- Аккаунт Supabase (уже настроен)
- Аккаунт Mapbox
- Аккаунт GitHub (уже настроен)

## 🛠️ Установка и запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка переменных окружения

Убедитесь, что файл `.env.local` содержит:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Настройка базы данных

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Перейдите в **SQL Editor**
3. Выполните миграции по порядку:
   - `001_initial_schema.sql` - Создание таблиц
   - `002_seed_regions.sql` - Добавление регионов Беларуси
   - `003_functions.sql` - Функции для работы с заказами
   - `004_rls_policies.sql` - Политики безопасности (RLS)

### 4. Запуск проекта

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## 👥 Роли пользователей

- **customer** - Заказчик (бары, рестораны, магазины)
- **client** - Клиент-получатель
- **driver** - Исполнитель (водитель)
- **fleet** - Автопарк
- **admin** - Администратор
- **superadmin** - Суперадмин

## 📊 Статусы заказов

- **searching_courier** - Ищем курьера
- **courier_coming** - Курьер едет к вам
- **courier_delivering** - Курьер доставляет заказ
- **completed** - Заказ завершен
- **cancelled** - Отменен

## 🗺️ Регионы

Приложение поддерживает 6 областей Беларуси:
- Минск
- Минская область
- Брестская область
- Витебская область
- Гомельская область
- Гродненская область
- Могилевская область

## 📝 Следующие шаги

1. Создайте первого суперадмина через Supabase Dashboard
2. Настройте тарифы для регионов
3. Начните разработку функционала

## 📚 Дополнительные ресурсы

- [Документация Next.js](https://nextjs.org/docs)
- [Документация Supabase](https://supabase.com/docs)
- [Документация Mapbox](https://docs.mapbox.com)
