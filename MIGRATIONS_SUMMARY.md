# Сводка миграций для системы управления водителями организацией

## Миграции для применения (в порядке):

### 1. **028_add_organization_id_to_profiles.sql**
   - Добавляет поле `organization_id` в таблицу `profiles`
   - Позволяет привязывать водителей к организациям

### 2. **029_add_driver_location_tracking.sql**
   - Добавляет поля `current_location` и `location_updated_at` в `profiles`
   - Для отслеживания местоположения водителей

### 3. **030_get_organization_drivers.sql**
   - RPC функции для работы с водителями организации:
     - `get_organization_drivers` - получение водителей организации
     - `get_organization_orders` - получение заказов водителей организации
     - `get_organization_finances` - получение финансов водителей организации

### 4. **031_search_available_drivers.sql**
   - RPC функция `search_available_drivers` для поиска свободных водителей
   - Обходит RLS для поиска водителей без привязки

### 5. **032_get_driver_profile_for_organization.sql**
   - RPC функция `get_driver_profile_for_organization` для получения профиля водителя
   - Используется для проверки перед привязкой

### 6. **033_allow_organizations_update_driver_organization.sql**
   - RPC функция `update_driver_organization` для привязки/отвязки водителя
   - Обходит RLS для обновления `organization_id`

### 7. **034_create_driver_organization_requests.sql**
   - Создает таблицу `driver_organization_requests` для запросов на привязку
   - Поля: `id`, `driver_user_id`, `organization_user_id`, `status`, `message`, `created_at`, `responded_at`

### 8. **035_rls_policies_for_requests.sql**
   - RLS политики для таблицы запросов:
     - Водители могут видеть свои запросы
     - Организации могут видеть свои запросы
     - Организации могут создавать запросы
     - Водители могут обновлять свои запросы (принимать/отклонять)
     - Организации могут отменять свои запросы

### 9. **036_functions_for_driver_requests.sql**
   - RPC функции для работы с запросами:
     - `create_driver_organization_request` - создание запроса
     - `get_driver_requests` - получение запросов водителя
     - `get_organization_requests` - получение запросов организации
     - `respond_to_organization_request` - ответ водителя на запрос
     - `cancel_organization_request` - отмена запроса организацией

## Как применить миграции:

1. Откройте Supabase Dashboard → SQL Editor
2. Примените миграции по порядку (028 → 036)
3. Или используйте Supabase CLI: `supabase migration up`

## Функционал после применения:

### Для организации:
- ✅ Создание нового аккаунта водителя (автоматически привязан)
- ✅ Поиск существующих водителей
- ✅ Отправка запроса на привязку водителю
- ✅ Просмотр списка отправленных запросов
- ✅ Отмена запросов
- ✅ Просмотр всех водителей организации
- ✅ Просмотр заказов водителей
- ✅ Просмотр финансов водителей
- ✅ Отслеживание местоположения водителей

### Для водителя:
- ✅ Просмотр входящих запросов от организаций
- ✅ Принятие/отклонение запросов
- ✅ Автоматическая привязка при принятии запроса

