-- Ручное тестирование триггера
-- Выполните этот скрипт в Supabase SQL Editor для проверки работы триггера

-- 1. Проверяем, существует ли триггер
SELECT 
  'Триггер' as check_type,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'on_order_payment_processed';

-- 2. Находим заказ для тестирования
SELECT 
  'Заказ для тестирования' as check_type,
  id,
  order_number,
  status,
  is_paid,
  executor_user_id,
  final_price
FROM public.orders
WHERE executor_user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
  AND (status = 'courier_delivering' OR status = 'completed')
  AND (is_paid IS NULL OR is_paid = false)
ORDER BY created_at DESC
LIMIT 1;

-- 3. Вручную обновляем is_paid для тестирования триггера
-- ЗАМЕНИТЕ 'ORDER_ID' на реальный ID заказа из предыдущего запроса
/*
UPDATE public.orders
SET is_paid = true
WHERE id = 'ORDER_ID'::UUID
  AND executor_user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729';
*/

-- 4. Проверяем, создалась ли транзакция
SELECT 
  'Транзакции после обновления' as check_type,
  t.id,
  t.user_id,
  t.order_id,
  t.amount,
  t.type,
  t.description,
  t.created_at
FROM public.transactions t
WHERE t.user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729'
ORDER BY t.created_at DESC
LIMIT 5;

-- 5. Проверяем баланс
SELECT 
  'Баланс после обновления' as check_type,
  user_id,
  amount,
  currency,
  updated_at
FROM public.balances
WHERE user_id = '3efb4975-5bfd-4151-920e-2ce5508f0729';

