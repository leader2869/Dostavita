# Предложения по улучшению проекта Dostavita

Отчёт составлен по результатам анализа кодовой базы.

---

## 1. Качество кода и типизация

### 1.1 Уменьшить использование `any`
Во многих страницах дашборда и API используется тип `any` (состояния, пропсы, ответы Supabase), что снижает пользу TypeScript.

**Рекомендации:**
- Подключить сгенерированные типы Supabase: выполнить `npm run supabase:types` и **закоммитить** `types/database.ts` в репозиторий (сейчас файл не в репо — папка `types/` не в `.gitignore`, но файл генерируется локально). Это даст типы для таблиц и RPC.
- В `lib/types.ts` уже есть доменные типы (`User`, `Order`, `Balance` и т.д.) — использовать их в компонентах и страницах вместо `any`.
- Для ответов RPC ввести интерфейсы в `lib/types.ts` (например, `OrganizationFinanceRow`, `OrganizationReceivableRow`) и использовать их в `customer/finance`, `driver/finance` и т.п.

### 1.2 Убрать отладочные `console.log`
В продакшене не нужны логи вида «Загрузка дебиторки», «Dashboard Page - getUser()», «Текущий URL» и т.д.

**Рекомендации:**
- Удалить или заменить на условное логирование: `if (process.env.NODE_ENV === 'development') console.log(...)`.
- Критичные ошибки оставлять через `console.error` или вынести в единый логгер/сервис ошибок.

**Где особенно много логов:** `app/dashboard/customer/finance/page.tsx`, `app/dashboard/page.tsx`, `app/dashboard/layout.tsx`.

---

## 2. Архитектура и переиспользование

### 2.1 Вынести общую логику загрузки баланса и профиля
Одинаковая схема повторяется на страницах:
- получить `getUser()`;
- загрузить баланс, при отсутствии — создать с 0;
- загрузить профиль и т.д.

**Рекомендации:**
- Хук `useAuthProfile()` или `useDashboardUser()`: возвращает `{ user, profile, balance, loading, error }`, внутри — единая логика загрузки и создания баланса при необходимости.
- Использовать его в `customer/finance`, `driver/finance`, `client/finance` и других страницах дашборда — меньше дублирования и проще поддержка.

### 2.2 Общая логика фильтра по периоду
`getDateFilter(period)` и состояния `period`, `customStartDate`, `customEndDate` повторяются на страницах финансов (customer, driver, client).

**Рекомендации:**
- Вынести в хук `useDateFilter(initialPeriod?: Period)` с возвратом `{ period, setPeriod, customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, getDateFilter }`.
- Переиспользовать на всех финансовых страницах.

### 2.3 Zustand не используется
В `package.json` есть зависимость `zustand`, в коде импортов не найдено.

**Рекомендации:**
- Либо начать использовать для глобального состояния (профиль, уведомления, выбранный период и т.д.), либо удалить из зависимостей.

---

## 3. Надёжность и UX

### 3.1 Error boundaries и loading
В проекте нет `error.tsx` и `loading.tsx` в маршрутах App Router.

**Рекомендации:**
- Добавить `app/dashboard/error.tsx` — показывать сообщение об ошибке и кнопку «Обновить» вместо белого экрана при падении любого дашборда.
- Добавить `app/dashboard/loading.tsx` — скелетон или спиннер на время загрузки layout/страниц.
- По желанию — точечные `loading.tsx` для тяжёлых разделов (например, `app/dashboard/customer/finance/loading.tsx`).

### 3.2 Обработка ошибок API
В части API routes ошибки не всегда возвращаются в едином формате; на клиенте часто только `alert(error.message)`.

**Рекомендации:**
- Ввести общий формат ответа API, например: `{ success: boolean, data?: T, error?: { code: string, message: string } }`.
- На клиенте обрабатывать ошибки через единый хелпер (тост или уведомление) вместо голого `alert`.

### 3.3 Валидация входных данных в API
Не везде проверяются тело запроса и права доступа.

**Рекомендации:**
- Использовать Zod для валидации тела в API routes (Zod уже в проекте).
- В каждом route проверять, что пользователь авторизован и имеет нужную роль (customer/driver/admin и т.д.), перед изменением данных.

---

## 4. Безопасность и конфигурация

### 4.1 Логирование чувствительных данных
В `app/dashboard/layout.tsx` есть `console.log('Текущий URL:', process.env.NEXT_PUBLIC_SUPABASE_URL')` — в проде лучше не логировать даже URL проекта.

**Рекомендации:**
- Удалить этот лог или оставлять только в dev.

### 4.2 Переменные окружения
Используются `process.env.NEXT_PUBLIC_*` и `SUPABASE_SERVICE_ROLE_KEY` в разных местах без централизации.

**Рекомендации:**
- Вынести в `lib/env.ts` (или `lib/config.ts`) объект с проверкой обязательных переменных при старте приложения и типизированным доступом — меньше риска опечаток и забытых переменных в деплое.

---

## 5. Тестирование и CI/CD

### 5.1 Тесты
В проекте нет юнит- и интеграционных тестов (нет jest/vitest, нет `*.test.*` / `*.spec.*`).

**Рекомендации:**
- Добавить Vitest (или Jest) + React Testing Library.
- Начать с тестов для утилит (`lib/utils/`, `getDateFilter` и т.п.) и критичных хуков.
- Затем покрыть ключевые API routes (create-driver, cancel order, finance RPC вызовы) и основные сценарии страниц (логин, редирект по ролям, отображение финансов).

### 5.2 CI/CD
В репозитории нет GitHub Actions (или аналога) для проверки сборки и линта.

**Рекомендации:**
- Добавить workflow: на каждый push/PR запускать `npm run lint`, `npm run type-check`, `npm run build`.
- Опционально — прогон тестов после их появления.

---

## 6. Производительность и Next.js

### 6.1 Тяжёлые клиентские страницы
Страницы вроде `customer/finance/page.tsx` и `client/create-order/page.tsx` очень большие (сотни строк), много состояния и эффектов.

**Рекомендации:**
- Разбить на меньшие компоненты (секции «Баланс», «Финансы по водителям», «Дебиторка», модалки вынести в отдельные файлы).
- Рассмотреть Server Components для первых загрузок данных (например, баланс и список водителей), а интерактив и фильтры оставить на клиенте с минимальным состоянием.

### 6.2 Загрузка данных в layout
В `dashboard/layout.tsx` загружаются профиль и редирект по ролям — это хорошо для централизованной авторизации. Убедиться, что не дублируются запросы на дочерних страницах (например, снова `getUser()` + профиль на каждой странице).

**Рекомендации:**
- Если данные из layout нужны на страницах — передавать через контекст или кэш (React cache / server), чтобы не дергать Supabase дважды.

---

## 7. База данных и Supabase

### 7.1 Типы БД в репозитории
Скрипт `supabase:types` генерирует `types/database.ts`, но файл не коммитится.

**Рекомендации:**
- Закоммитить `types/database.ts` и обновлять его при изменении миграций. Так все разработчики и CI будут использовать одинаковые типы и видеть поломки при изменении схемы.

### 7.2 Миграции
Миграций много (117+), структура в целом ясная. При добавлении новых — придерживаться именования и проверять откат (down), где он нужен.

---

## Приоритизация

| Приоритет | Что сделать | Эффект |
|-----------|-------------|--------|
| Высокий   | Убрать/условить `console.log`, убрать лог URL в layout | Безопасность и чистота логов в проде |
| Высокий   | Добавить `error.tsx` и `loading.tsx` в dashboard | Стабильный UX при ошибках и загрузке |
| Высокий   | Закоммитить и использовать `types/database.ts`, уменьшить `any` | Меньше багов, лучшая поддержка |
| Средний   | Хук для загрузки пользователя/баланса, хук для фильтра дат | Меньше дублирования, проще правки |
| Средний   | Валидация (Zod) и проверка ролей в API | Безопасность |
| Средний   | Разбить большие страницы (finance, create-order) на компоненты | Читаемость и поддержка |
| Низкий    | Добавить Vitest + первые тесты | Уверенность при рефакторинге |
| Низкий    | GitHub Actions: lint, type-check, build | Раннее обнаружение поломок |
| Низкий    | Решить судьбу Zustand (использовать или удалить) | Чистота зависимостей |

Если нужно, могу расписать конкретные шаги или патчи по любому из пунктов (например, пример хука `useDateFilter` или содержимое `error.tsx`/`loading.tsx`).

---

## Выполнено (актуально)

- **Кэш auth** — `getCachedUserAndProfile()` в RSC, серверные страницы дашборда (driver, customer, fleet, admin) используют кэш.
- **Контекст дашборда** — `DashboardAuthProvider` + `useDashboardUser()`; страницы client, customer, driver, admin переведены на хук (в т.ч. driver/profile, driver/requests, driver/chat, driver/finance, client/addresses, client/finance, client/profile, client/create-order, client/orders/[id]/edit, customer/drivers, customer/profile, customer/finance, admin/users, admin/delivery-settings и др.).
- **Статусы заказов** — общий модуль `lib/utils/orderStatus.ts` (getOrderStatusLabel, getOrderStatusColor, getOrderStatusColorHex, isActiveOrderStatus).
- **Один ExportOrdersButton** — `components/ExportOrdersButton.tsx` с опциональным `filename`/`defaultFilenamePrefix`.
- **API** — профиль (create, upload-avatar), orders/cancel, admin/delete-user, push/register, push/unregister, push/send, admin/reset-password, orders/notify-drivers, nominatim/search, nominatim/reverse переведены на `apiSuccess`/`apiError` и при необходимости маскирование внутренних ошибок в production.
- **Константы** — `MAX_AVATAR_SIZE_BYTES`, `MAX_CHAT_PHOTO_SIZE_BYTES` в `lib/constants.ts`.
- **N+1** — загрузка профилей курьеров на главной клиента одним запросом.
- **Отладка** — убран `_debug_receivable`, упрощён middleware; отладочные страницы редиректят в production.
- **Zustand** — удалён из зависимостей (не использовался).
- **README** — обновлён раздел про состояние; добавлен `.env.example`.
- **console.log** — отладочные логи убраны или обёрнуты в `NODE_ENV === 'development'` (PaymentModal, AcceptOrderModal, OrderStatusRealtime, AvailableOrdersList, AddressAutocomplete, DriverChatSection, NewOrderNotification, DriverLocationMap, DriverPushNotifications, usePushNotifications, useDriverLocationTracking).
- **Централизация env** — `lib/config.ts` с экспортом SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, VAPID_*, APP_URL и функцией `assertRequiredEnv()`; Supabase client/server/middleware и admin/reset-password используют config.
- **CI** — GitHub Actions: на push/PR запускаются lint, type-check, build (`.github/workflows/ci.yml`).
- **Nominatim** — in-memory rate limit 1 req/s на IP для search и reverse (`lib/rate-limit.ts`).

## Следующие шаги (что ещё можно улучшить)

1. **Типизация** — закоммитить `types/database.ts`, постепенно заменять `any` на типы из `lib/types` и Supabase.
2. **Тесты** — Vitest + первые тесты для утилит (orderStatus, formatAddress) и при желании для критичных API.
3. **error.tsx / loading.tsx** в dashboard — стабильный UX при ошибках и загрузке.
4. **Оставшиеся страницы на useDashboardUser** — client/orders/[id], driver/orders/[id], driver/accept-order/[id], customer/create-order (опционально, для полного отказа от локальных getUser).
5. **Оставшиеся API на config** — customer/create-driver, orders/notify-drivers, push/send использовать `lib/config` для VAPID/SUPABASE_URL где уместно.
