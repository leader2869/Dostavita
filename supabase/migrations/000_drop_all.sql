-- ⚠️ ВНИМАНИЕ: Этот скрипт полностью удаляет все таблицы, функции, триггеры и данные из базы данных
-- ⚠️ ВЫПОЛНЯЙТЕ ТОЛЬКО ЕСЛИ ВЫ УВЕРЕНЫ, ЧТО ХОТИТЕ НАЧАТЬ С НУЛЯ
-- ⚠️ ЭТО ДЕЙСТВИЕ НЕОБРАТИМО!

-- Отключаем проверку внешних ключей временно для упрощения удаления
SET session_replication_role = 'replica';

-- ============================================
-- УДАЛЕНИЕ ТРИГГЕРОВ
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trigger_update_today_orders_count ON public.orders;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_balances_updated_at ON public.balances;

-- ============================================
-- УДАЛЕНИЕ ФУНКЦИЙ
-- ============================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.accept_order(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.complete_order(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_driver_rating(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.update_today_orders_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- ============================================
-- УДАЛЕНИЕ ТАБЛИЦ (в правильном порядке из-за внешних ключей)
-- ============================================

-- Удаляем таблицы с зависимостями сначала
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.balances CASCADE;
DROP TABLE IF EXISTS public.drivers CASCADE;
DROP TABLE IF EXISTS public.fleets CASCADE;
DROP TABLE IF EXISTS public.regions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================
-- УДАЛЕНИЕ ИНДЕКСОВ (если остались)
-- ============================================

-- Индексы автоматически удаляются при удалении таблиц,
-- но на всякий случай удаляем явно, если они остались

DROP INDEX IF EXISTS public.idx_profiles_role;
DROP INDEX IF EXISTS public.idx_drivers_fleet_id;
DROP INDEX IF EXISTS public.idx_drivers_is_available;
DROP INDEX IF EXISTS public.idx_drivers_shift_status;
DROP INDEX IF EXISTS public.idx_drivers_is_available_shift;
DROP INDEX IF EXISTS public.idx_orders_customer_id;
DROP INDEX IF EXISTS public.idx_orders_client_id;
DROP INDEX IF EXISTS public.idx_orders_driver_id;
DROP INDEX IF EXISTS public.idx_orders_fleet_id;
DROP INDEX IF EXISTS public.idx_orders_status;
DROP INDEX IF EXISTS public.idx_orders_visibility;
DROP INDEX IF EXISTS public.idx_orders_created_at;
DROP INDEX IF EXISTS public.idx_orders_executor_user_id;
DROP INDEX IF EXISTS public.idx_transactions_user_id;
DROP INDEX IF EXISTS public.idx_transactions_order_id;

-- ============================================
-- УДАЛЕНИЕ STORAGE BUCKETS (если есть)
-- ============================================

-- Удаляем bucket для аватаров (если существует)
-- Внимание: это удалит все загруженные файлы!
-- Раскомментируйте, если нужно удалить storage

-- DELETE FROM storage.objects WHERE bucket_id = 'avatars';
-- DELETE FROM storage.buckets WHERE id = 'avatars';

-- ============================================
-- ОЧИСТКА RLS ПОЛИТИК (автоматически удаляются с таблицами)
-- ============================================

-- Политики RLS автоматически удаляются при удалении таблиц
-- Но можно явно удалить, если они остались:

-- DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
-- ... и т.д. (политики удаляются автоматически с таблицами)

-- ============================================
-- ВОССТАНОВЛЕНИЕ НАСТРОЕК
-- ============================================

-- Восстанавливаем нормальный режим репликации
SET session_replication_role = 'origin';

-- ============================================
-- ПРОВЕРКА: Убедимся, что все удалено
-- ============================================

-- Проверяем, что таблицы удалены
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('profiles', 'drivers', 'fleets', 'orders', 'regions', 'balances', 'transactions');
    
    IF table_count > 0 THEN
        RAISE NOTICE '⚠️ ВНИМАНИЕ: Осталось % таблиц в схеме public', table_count;
    ELSE
        RAISE NOTICE '✅ Все таблицы успешно удалены';
    END IF;
END $$;

-- Проверяем, что функции удалены
DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN ('handle_new_user', 'accept_order', 'complete_order', 'update_driver_rating', 'update_today_orders_count', 'update_updated_at_column');
    
    IF func_count > 0 THEN
        RAISE NOTICE '⚠️ ВНИМАНИЕ: Осталось % функций в схеме public', func_count;
    ELSE
        RAISE NOTICE '✅ Все функции успешно удалены';
    END IF;
END $$;

-- ============================================
-- ЗАВЕРШЕНИЕ
-- ============================================

-- Выводим сообщение об успешном завершении
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Очистка базы данных завершена!';
    RAISE NOTICE 'Теперь вы можете применить миграции заново';
    RAISE NOTICE '========================================';
END $$;
