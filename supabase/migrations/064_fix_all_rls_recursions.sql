-- Миграция 064: Исправление всех оставшихся рекурсий RLS
-- Эта миграция исправляет все политики, которые используют прямой SELECT из profiles

-- 1. Исправляем политику для order_rejections
DROP POLICY IF EXISTS "Superadmins can view all rejections" ON public.order_rejections;
CREATE POLICY "Superadmins can view all rejections"
  ON public.order_rejections FOR SELECT
  TO authenticated
  USING (
    -- Используем функцию check_user_role вместо прямого SELECT из profiles
    public.check_user_role(auth.uid(), 'superadmin')
  );

COMMENT ON POLICY "Superadmins can view all rejections" ON public.order_rejections IS 
  'Позволяет суперадминам видеть все отказы. Использует check_user_role для избежания рекурсии RLS.';

