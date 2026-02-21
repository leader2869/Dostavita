# Чеклист проверки страниц на ошибки и лишние зависимости

## 🔴 Критические ошибки
Нет критических ошибок компиляции. Сборка проходит успешно.

## ⚠️ Предупреждения ESLint (React Hooks)

### 1. **app/dashboard/client/finance/page.tsx**
   - **Строка 130**: `useCallback` имеет ненужные зависимости: `customEndDate` и `customStartDate`
   - **Действие**: Удалить эти зависимости из массива зависимостей или исключить их

### 2. **app/dashboard/client/orders/page.tsx**
   - **Строка 158**: `useCallback` имеет ненужные зависимости: `customEndDate` и `customStartDate`
   - **Строка 295**: `useEffect` имеет отсутствующие зависимости: `activeOrders`, `allActiveOrders`, `completedOrdersFromAll`, `filteredCompletedOrders`
   - **Действие**: Добавить недостающие зависимости или удалить массив зависимостей

### 3. **app/dashboard/customer/finance/page.tsx**
   - **Строка 206**: `useCallback` имеет ненужные зависимости: `customEndDate` и `customStartDate`
   - **Действие**: Удалить эти зависимости из массива зависимостей

### 4. **app/dashboard/driver/chat/page.tsx**
   - **Строка 40**: `useEffect` имеет отсутствующую зависимость: `supabase`
   - **Действие**: Добавить `supabase` в массив зависимостей или использовать `useCallback` для стабильности

### 5. **app/dashboard/driver/finance/page.tsx**
   - **Строка 308**: `useCallback` имеет ненужные зависимости: `customEndDate` и `customStartDate`
   - **Действие**: Удалить эти зависимости из массива зависимостей

### 6. **components/chat/DriverOrganizationChat.tsx**
   - **Строка 235**: `useEffect` имеет отсутствующие зависимости: `currentUserId`, `onMessagesRead`, `senderNames`
   - **Действие**: Добавить недостающие зависимости или обернуть `onMessagesRead` в `useCallback` в родительском компоненте

### 7. **components/driver/AvailableOrdersList.tsx**
   - **Строка 121**: `useEffect` имеет отсутствующую зависимость: `supabase`
   - **Действие**: Добавить `supabase` в массив зависимостей (или оставить пустым, если supabase стабилен)

### 8. **components/driver/DriverBottomNavigation.tsx**
   - **Строка 71**: `useEffect` имеет отсутствующую зависимость: `supabase`
   - **Действие**: Добавить `supabase` в массив зависимостей (или оставить пустым, если supabase стабилен)

### 9. **components/driver/DriverChatSection.tsx**
   - **Строка 106**: `useEffect` имеет отсутствующую зависимость: `supabase`
   - **Действие**: Добавить `supabase` в массив зависимостей

### 10. **components/driver/DriverLocationTracker.tsx**
   - **Строка 68**: `useEffect` имеет отсутствующую зависимость: `supabase`
   - **Действие**: Добавить `supabase` в массив зависимостей

### 11. **components/driver/NewOrderNotification.tsx**
   - **Строка 144**: `useEffect` имеет отсутствующую зависимость: `supabase`
   - **Строка 216**: `useEffect` имеет отсутствующую зависимость: `supabase.auth`
   - **Действие**: Добавить недостающие зависимости в массивы зависимостей

## 📋 Список всех страниц для проверки

### Авторизация
- [ ] `app/(auth)/login/page.tsx`
- [ ] `app/(auth)/register/page.tsx`

### Водитель (Driver)
- [ ] `app/dashboard/driver/page.tsx` - Главная страница водителя
- [ ] `app/dashboard/driver/my-orders/page.tsx` - Мои заказы
- [ ] `app/dashboard/driver/orders/[id]/page.tsx` - Детали заказа
- [ ] `app/dashboard/driver/finance/page.tsx` - ⚠️ Предупреждение ESLint (строка 308)
- [ ] `app/dashboard/driver/profile/page.tsx` - Профиль
- [ ] `app/dashboard/driver/chat/page.tsx` - ⚠️ Предупреждение ESLint (строка 40)
- [ ] `app/dashboard/driver/accept-order/[id]/page.tsx` - Принять заказ
- [ ] `app/dashboard/driver/requests/page.tsx` - Запросы

### Клиент (Client)
- [ ] `app/dashboard/client/page.tsx` - Главная страница клиента
- [ ] `app/dashboard/client/orders/page.tsx` - ⚠️ Предупреждения ESLint (строки 158, 295)
- [ ] `app/dashboard/client/orders/[id]/page.tsx` - Детали заказа
- [ ] `app/dashboard/client/orders/[id]/edit/page.tsx` - Редактирование заказа
- [ ] `app/dashboard/client/create-order/page.tsx` - Создание заказа
- [ ] `app/dashboard/client/finance/page.tsx` - ⚠️ Предупреждение ESLint (строка 130)
- [ ] `app/dashboard/client/profile/page.tsx` - Профиль
- [ ] `app/dashboard/client/addresses/page.tsx` - Адреса

### Организация (Customer)
- [ ] `app/dashboard/customer/page.tsx` - Главная страница организации
- [ ] `app/dashboard/customer/orders/page.tsx` - Заказы
- [ ] `app/dashboard/customer/orders/[id]/page.tsx` - Детали заказа
- [ ] `app/dashboard/customer/available-orders/page.tsx` - Доступные заказы
- [ ] `app/dashboard/customer/drivers/page.tsx` - Водители
- [ ] `app/dashboard/customer/drivers/[id]/page.tsx` - Профиль водителя
- [ ] `app/dashboard/customer/finance/page.tsx` - ⚠️ Предупреждение ESLint (строка 206)
- [ ] `app/dashboard/customer/profile/page.tsx` - Профиль
- [ ] `app/dashboard/customer/create-order/page.tsx` - Создание заказа

### Админ (Admin)
- [ ] `app/dashboard/admin/page.tsx` - Главная страница админа
- [ ] `app/dashboard/admin/orders/page.tsx` - Заказы
- [ ] `app/dashboard/admin/users/page.tsx` - Пользователи
- [ ] `app/dashboard/admin/personnel/page.tsx` - Персонал
- [ ] `app/dashboard/admin/tariffs/page.tsx` - Тарифы
- [ ] `app/dashboard/admin/delivery-settings/page.tsx` - Настройки доставки

### Прочие
- [ ] `app/dashboard/page.tsx` - Общая страница дашборда
- [ ] `app/page.tsx` - Главная страница
- [ ] `app/fonts-preview/page.tsx` - Превью шрифтов
- [ ] `app/icon-selector/page.tsx` - Выбор иконок
- [ ] `app/debug-auth/page.tsx` - Отладка авторизации
- [ ] `app/dashboard/fleet/page.tsx` - Флот

## 🔍 Компоненты для проверки

### Компоненты водителя
- [ ] `components/driver/AvailableOrdersList.tsx` - ⚠️ Предупреждение ESLint (строка 121)
- [ ] `components/driver/DriverBottomNavigation.tsx` - ⚠️ Предупреждение ESLint (строка 71)
- [ ] `components/driver/DriverChatSection.tsx` - ⚠️ Предупреждение ESLint (строка 106)
- [ ] `components/driver/DriverLocationTracker.tsx` - ⚠️ Предупреждение ESLint (строка 68)
- [ ] `components/driver/NewOrderNotification.tsx` - ⚠️ Предупреждения ESLint (строки 144, 216)
- [ ] `components/driver/AcceptOrderModal.tsx`
- [ ] `components/driver/OrderActions.tsx`
- [ ] `components/driver/DriverPushNotifications.tsx`

### Компоненты чата
- [ ] `components/chat/DriverOrganizationChat.tsx` - ⚠️ Предупреждение ESLint (строка 235)
- [ ] `components/chat/DriverClientChat.tsx`

### Компоненты клиента
- [ ] `components/client/ClientOrderActions.tsx`
- [ ] `components/client/ClientBottomNavigation.tsx`

### Компоненты организации
- [ ] `components/customer/CustomerBottomNavigation.tsx`
- [ ] `components/customer/DriverOrdersHistory.tsx`
- [ ] `components/customer/OrderStatusRealtime.tsx`

## 📦 Проверка зависимостей

### Возможные неиспользуемые зависимости
Проверить использование следующих библиотек:
- [ ] `zustand` - используется ли state management?
- [ ] `zod` - используется ли валидация?
- [ ] `xlsx` - используется ли экспорт в Excel?
- [ ] `@supabase/auth-helpers-nextjs` - используется ли вместе с `@supabase/ssr`?

## 🎯 Приоритетные задачи

1. **Высокий приоритет**: Исправить предупреждения ESLint в основных страницах (client/orders, customer/finance, driver/finance)
2. **Средний приоритет**: Проверить и исправить зависимости в useEffect/useCallback
3. **Низкий приоритет**: Проверить неиспользуемые зависимости в package.json

## 📝 Примечания

- Все предупреждения ESLint связаны с зависимостями React Hooks
- Нет критических ошибок компиляции
- Сборка проходит успешно
- API routes имеют предупреждения о Dynamic server usage, но это нормально для API routes

