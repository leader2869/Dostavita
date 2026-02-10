# Полная очистка базы данных Supabase

## ⚠️ ВНИМАНИЕ

Этот скрипт **полностью удаляет** все таблицы, функции, триггеры и данные из базы данных. Это действие **необратимо**!

## 📋 Что будет удалено:

- ✅ Все таблицы (`profiles`, `drivers`, `fleets`, `orders`, `regions`, `balances`, `transactions`)
- ✅ Все функции (`handle_new_user`, `accept_order`, `complete_order`, и т.д.)
- ✅ Все триггеры
- ✅ Все индексы
- ✅ Все данные

## 🚀 Как использовать:

### Вариант 1: Через Supabase Dashboard (Рекомендуется)

1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в **SQL Editor**
4. Откройте файл `supabase/migrations/000_drop_all.sql`
5. Скопируйте весь содержимое скрипта
6. Вставьте в SQL Editor
7. **Внимательно прочитайте предупреждения в скрипте**
8. Нажмите **Run** или **Ctrl+Enter**

### Вариант 2: Через Supabase CLI

```bash
# Убедитесь, что вы подключены к проекту
supabase link --project-ref your-project-ref

# Выполните скрипт
psql $(supabase db url) -f supabase/migrations/000_drop_all.sql
```

## ✅ После выполнения:

1. Убедитесь, что скрипт выполнился без ошибок
2. Проверьте, что все таблицы удалены (в SQL Editor выполните):
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```
   Должен вернуть пустой результат или только системные таблицы

3. Теперь вы можете применить миграции заново:
   - Через Dashboard: выполните миграции по порядку (001, 002, 003, и т.д.)
   - Через CLI: `supabase db push`

## 🔄 Восстановление после очистки:

После очистки выполните миграции в следующем порядке:

1. `001_initial_schema.sql` - Создание таблиц
2. `002_rls_policies.sql` или `002_rls_policies_fixed.sql` - Политики безопасности
3. `003_seed_data.sql` - Начальные данные (опционально)
4. `004_functions.sql` - Функции и триггеры
5. Остальные миграции по порядку

## ⚠️ Важные замечания:

- **Storage Buckets**: Скрипт не удаляет storage buckets автоматически. Если нужно удалить аватары, раскомментируйте соответствующие строки в скрипте.
- **Auth Users**: Скрипт **НЕ удаляет** пользователей из `auth.users`. Если нужно удалить и их, выполните отдельно:
  ```sql
  DELETE FROM auth.users;
  ```
  ⚠️ Это удалит всех пользователей, включая суперадмина!

- **Расширения**: Расширения PostgreSQL (uuid-ossp, postgis) не удаляются, так как они могут использоваться другими проектами.

## 🆘 Если что-то пошло не так:

Если после выполнения скрипта остались какие-то объекты, вы можете удалить их вручную:

```sql
-- Удалить конкретную таблицу
DROP TABLE IF EXISTS public.table_name CASCADE;

-- Удалить конкретную функцию
DROP FUNCTION IF EXISTS public.function_name CASCADE;

-- Просмотреть все таблицы
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Просмотреть все функции
SELECT proname 
FROM pg_proc 
JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
WHERE pg_namespace.nspname = 'public';
```

## 📝 Альтернативный способ (более безопасный):

Если вы хотите сохранить структуру, но очистить только данные:

```sql
-- Очистка данных без удаления структуры
TRUNCATE TABLE public.transactions CASCADE;
TRUNCATE TABLE public.orders CASCADE;
TRUNCATE TABLE public.balances CASCADE;
TRUNCATE TABLE public.drivers CASCADE;
TRUNCATE TABLE public.fleets CASCADE;
TRUNCATE TABLE public.regions CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
```

Это удалит все данные, но сохранит структуру таблиц, функции и триггеры.

