-- Миграция 096: Исправление RLS политики для receivables для организаций
-- Убеждаемся, что организации могут видеть дебиторку своих водителей

-- Удаляем старую политику (если она существует)
DROP POLICY IF EXISTS "Organizations can view receivables for their drivers' orders" ON public.receivables;

-- Создаем новую политику, которая использует organization_id напрямую
CREATE POLICY "Organizations can view receivables for their drivers' orders"
  ON public.receivables
  FOR SELECT
  USING (
    -- Фильтруем напрямую по organization_id в receivables
    receivables.organization_id = auth.uid()
    -- ИЛИ через JOIN (для обратной совместимости, если organization_id еще не заполнен)
    OR EXISTS (
      SELECT 1 FROM public.orders o
      INNER JOIN public.profiles d ON o.executor_user_id = d.id
      WHERE o.id = receivables.order_id
        AND d.organization_id = auth.uid()
    )
  );

-- Комментарий к политике
COMMENT ON POLICY "Organizations can view receivables for their drivers' orders" ON public.receivables IS 
  'Позволяет организациям видеть дебиторку по заказам своих водителей. Использует organization_id напрямую или через JOIN для обратной совместимости.';

-- Проверяем, что RLS включен
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

