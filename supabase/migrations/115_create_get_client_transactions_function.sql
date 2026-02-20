-- Миграция 115: Функция для получения транзакций клиента
-- Клиент может видеть транзакции, связанные с его заказами (включая оплаты водителем)

CREATE OR REPLACE FUNCTION public.get_client_transactions(
  client_user_id UUID,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  order_id UUID,
  amount DECIMAL(10, 2),
  type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  related_user_id UUID,
  order_number INTEGER,
  order_final_price DECIMAL(10, 2),
  order_customer_id UUID,
  order_client_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Проверяем, что вызывающий пользователь является клиентом
  SELECT p.role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  IF NOT FOUND OR caller_role != 'client' THEN
    RAISE EXCEPTION 'Доступ запрещен. Только клиенты могут просматривать свои транзакции.';
  END IF;
  
  -- Проверяем, что client_user_id совпадает с текущим пользователем
  IF client_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Вы можете просматривать только свои транзакции.';
  END IF;
  
  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    t.order_id,
    t.amount,
    t.type,
    t.description,
    t.created_at,
    t.related_user_id,
    o.order_number,
    o.final_price as order_final_price,
    o.customer_id as order_customer_id,
    o.client_id as order_client_id
  FROM public.transactions t
  INNER JOIN public.orders o ON o.id = t.order_id
  WHERE (o.customer_id = client_user_id OR o.client_id = client_user_id)
    AND (start_date IS NULL OR t.created_at >= start_date)
    AND (end_date IS NULL OR t.created_at <= end_date)
  ORDER BY t.created_at DESC;
END;
$$;

-- Даем права на выполнение функции клиентам
GRANT EXECUTE ON FUNCTION public.get_client_transactions(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

