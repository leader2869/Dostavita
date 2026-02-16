-- Миграция 076: Добавление поля ready_at (время готовности заказа) в таблицу orders
-- Это поле необязательное и используется для заказов, где важно указать время готовности (например, доставка еды)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'ready_at'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN ready_at TIMESTAMPTZ;
    
    COMMENT ON COLUMN public.orders.ready_at IS 'Время, когда заказ будет готов (необязательное поле, актуально для доставки еды и т.д.)';
  END IF;
END $$;
