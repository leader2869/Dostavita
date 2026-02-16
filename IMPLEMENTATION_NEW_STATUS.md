# Реализация нового статуса "courier_accepted"

## Выполненные изменения:

### 1. Типы и константы ✅
- `lib/types.ts` - добавлен `courier_accepted` в `OrderStatus`
- `lib/constants.ts` - добавлена метка "Курьер принял заказ"

### 2. База данных (миграция 073) ✅
- Создана миграция `073_add_courier_accepted_status.sql`
- Обновлена функция `accept_order()` - теперь устанавливает `courier_accepted` вместо `courier_coming`
- Создана новая функция `start_coming_to_pickup()` - переход из `courier_accepted` в `courier_coming`

### 3. Функции форматирования статусов ✅
Обновлены во всех компонентах:
- ✅ `app/dashboard/client/page.tsx`
- ✅ `app/dashboard/client/orders/page.tsx`
- ✅ `app/dashboard/client/orders/[id]/page.tsx`
- ✅ `app/dashboard/driver/page.tsx`
- ✅ `app/dashboard/driver/my-orders/page.tsx`
- ✅ `app/dashboard/driver/orders/[id]/page.tsx`
- ✅ `app/dashboard/customer/orders/page.tsx`
- ✅ `app/dashboard/customer/orders/[id]/page.tsx`
- ✅ `app/dashboard/customer/drivers/[id]/page.tsx`
- ✅ `app/dashboard/customer/page.tsx`
- ✅ `app/dashboard/admin/orders/page.tsx`
- ✅ `app/dashboard/admin/page.tsx`
- ✅ `components/map/OrdersMap.tsx`

### 4. UI для водителя ✅
- Добавлена кнопка "Начать движение к отправителю" для статуса `courier_accepted`
- Добавлена функция `handleStartComing()` в `app/dashboard/driver/orders/[id]/page.tsx`

### 5. Фильтры и логика отображения ✅
- Обновлены фильтры активных заказов (добавлен `courier_accepted`)
- Обновлена логика мигания статусов (добавлен `courier_accepted`)
- Обновлены проверки `canStartComing`, `canPickup`, `canComplete`

## Новая последовательность статусов:

1. `searching_courier` - Ищем курьера
2. **`courier_accepted`** - Курьер принял заказ (НОВЫЙ)
3. `courier_coming` - Курьер едет к отправителю
4. `courier_delivering` - Курьер едет к получателю
5. `completed` - Заказ завершен

## Переходы между статусами:

```
searching_courier 
  → accept_order() 
  → courier_accepted 
  → start_coming_to_pickup() (кнопка "Начать движение к отправителю")
  → courier_coming 
  → pickup_order() 
  → courier_delivering 
  → complete_order() 
  → completed
```

## Унифицированные тексты статусов (для всех ролей):

- `searching_courier`: "Ищем курьера"
- `courier_accepted`: "Курьер принял заказ"
- `courier_coming`: "Курьер едет к отправителю"
- `courier_delivering`: "Курьер едет к получателю"
- `completed`: "Заказ завершен"
- `cancelled`: "Отменен"

## Цвета статусов (унифицированные):

- `searching_courier`: Желтый (`text-yellow-400`)
- `courier_accepted`: Оранжевый (`text-orange-400`) - НОВЫЙ
- `courier_coming`: Синий (`text-blue-400`)
- `courier_delivering`: Фиолетовый (`text-purple-400`)
- `completed`: Зеленый (`text-green-400`)
- `cancelled`: Красный (`text-red-400`)

## Мигающие статусы:

Все активные статусы мигают:
- `searching_courier` ✅
- `courier_accepted` ✅ (НОВЫЙ)
- `courier_coming` ✅
- `courier_delivering` ✅

## Что нужно сделать:

1. **Применить миграцию 073** в Supabase SQL Editor:
   - Открыть `supabase/migrations/073_add_courier_accepted_status.sql`
   - Скопировать и выполнить в Supabase Dashboard → SQL Editor

2. **Проверить работу**:
   - Водитель принимает заказ → статус должен быть `courier_accepted`
   - Водитель нажимает "Начать движение к отправителю" → статус меняется на `courier_coming`
   - Все роли видят одинаковые тексты статусов
   - Статус `courier_accepted` мигает

## Важные замечания:

- Старые заказы со статусом `courier_coming` останутся без изменений
- Новые заказы будут проходить через новый статус `courier_accepted`
- Функция `accept_order()` теперь устанавливает `courier_accepted`, а не `courier_coming`
- Новая функция `start_coming_to_pickup()` переводит из `courier_accepted` в `courier_coming`

