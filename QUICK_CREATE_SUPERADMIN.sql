-- БЫСТРОЕ СОЗДАНИЕ СУПЕРАДМИНА
-- Замените 'your-email@example.com' на email существующего пользователя

UPDATE public.profiles
SET role = 'superadmin'
WHERE email = 'your-email@example.com'; -- ЗАМЕНИТЕ НА ВАШ EMAIL

-- Проверка
SELECT 
  email,
  role,
  full_name,
  CASE 
    WHEN role = 'superadmin' THEN '✅ Суперадмин создан'
    ELSE '❌ Ошибка'
  END as status
FROM public.profiles
WHERE email = 'your-email@example.com'; -- ЗАМЕНИТЕ НА ВАШ EMAIL





