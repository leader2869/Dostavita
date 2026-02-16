# План внедрения нового статуса "Курьер принял заказ"

## Новая логика статусов:

1. `searching_courier` - Ищем курьера
2. **`courier_accepted`** - Курьер принял заказ (НОВЫЙ)
3. `courier_coming` - Курьер едет к отправителю (было "Курьер едет к вам")
4. `courier_delivering` - Курьер едет к получателю (было "Курьер доставляет заказ")
5. `completed` - Заказ завершен

## Последовательность переходов:

```
searching_courier 
  → accept_order() 
  → courier_accepted 
  → start_coming_to_pickup() (новая функция или кнопка)
  → courier_coming 
  → pickup_order() 
  → courier_delivering 
  → complete_order() 
  → completed
```

## Что нужно изменить:

### 1. Типы и константы
- [ ] `lib/types.ts` - добавить `courier_accepted` в `OrderStatus`
- [ ] `lib/constants.ts` - добавить метку для нового статуса

### 2. База данных (миграция)
- [ ] Создать миграцию для обновления функций:
  - `accept_order()` - устанавливать `courier_accepted` вместо `courier_coming`
  - Создать новую функцию `start_coming_to_pickup()` - переход из `courier_accepted` в `courier_coming`
  - `pickup_order()` - оставить как есть (переход из `courier_coming` в `courier_delivering`)

### 3. Функции форматирования статусов (все роли)
- [ ] `app/dashboard/client/page.tsx` - добавить `courier_accepted`
- [ ] `app/dashboard/client/orders/page.tsx` - добавить `courier_accepted`
- [ ] `app/dashboard/client/orders/[id]/page.tsx` - добавить `courier_accepted`
- [ ] `app/dashboard/driver/page.tsx` - добавить `courier_accepted`
- [ ] `app/dashboard/driver/my-orders/page.tsx` - добавить `courier_accepted`
- [ ] `app/dashboard/driver/orders/[id]/page.tsx` - добавить `courier_accepted`
- [ ] `app/dashboard/customer/orders/page.tsx` - добавить `courier_accepted`
- [ ] `app/dashboard/customer/orders/[id]/page.tsx` - добавить `courier_accepted`
- [ ] `app/dashboard/customer/drivers/[id]/page.tsx` - добавить `courier_accepted`
- [ ] `app/dashboard/admin/orders/page.tsx` - добавить `courier_accepted`
- [ ] `app/dashboard/admin/page.tsx` - добавить `courier_accepted`
- [ ] `components/map/OrdersMap.tsx` - добавить `courier_accepted`

### 4. Логика фильтрации и отображения
- [ ] Обновить фильтры активных заказов (добавить `courier_accepted`)
- [ ] Обновить логику мигания статусов
- [ ] Обновить проверки `canEdit`, `canPickup`, `canComplete`

### 5. UI для водителя
- [ ] Добавить кнопку "Начать движение к отправителю" для статуса `courier_accepted`
- [ ] Обновить страницу деталей заказа водителя

### 6. Тексты статусов (унифицированные для всех ролей):
- `searching_courier`: "Ищем курьера"
- `courier_accepted`: "Курьер принял заказ"
- `courier_coming`: "Курьер едет к отправителю"
- `courier_delivering`: "Курьер едет к получателю"
- `completed`: "Заказ завершен"
- `cancelled`: "Отменен"

### 7. Цвета статусов (унифицированные):
- `searching_courier`: Желтый
- `courier_accepted`: Оранжевый (новый цвет)
- `courier_coming`: Синий
- `courier_delivering`: Фиолетовый
- `completed`: Зеленый
- `cancelled`: Красный

## Вопросы для уточнения:

1. Нужна ли кнопка для перехода из `courier_accepted` в `courier_coming`, или это должно происходить автоматически?
2. Должен ли статус `courier_accepted` мигать?
3. Видят ли клиенты статус `courier_accepted` или он только для водителя?

