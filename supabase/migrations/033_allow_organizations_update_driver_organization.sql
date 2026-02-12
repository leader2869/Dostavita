-- Миграция 033: RPC функция для обновления organization_id водителя (обходит RLS)

-- Функция для привязки/отвязки водителя к организации
CREATE OR REPLACE FUNCTION public.update_driver_organization(
  driver_user_id UUID,
  organization_user_id UUID,
  action TEXT -- 'attach' или 'detach'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  driver_role TEXT;
  current_org_id UUID;
BEGIN
  -- Проверяем, что пользователь существует и является водителем
  SELECT role, organization_id INTO driver_role, current_org_id
  FROM public.profiles
  WHERE id = driver_user_id;

  IF NOT FOUND OR driver_role != 'driver' THEN
    RETURN FALSE;
  END IF;

  -- Если action = 'attach', привязываем водителя
  IF action = 'attach' THEN
    -- Проверяем, что водитель не привязан к другой организации
    IF current_org_id IS NOT NULL AND current_org_id != organization_user_id THEN
      RETURN FALSE;
    END IF;

    -- Привязываем водителя
    UPDATE public.profiles
    SET organization_id = organization_user_id
    WHERE id = driver_user_id;
    
    RETURN TRUE;
  END IF;

  -- Если action = 'detach', отвязываем водителя
  IF action = 'detach' THEN
    -- Проверяем, что водитель привязан к этой организации
    IF current_org_id != organization_user_id THEN
      RETURN FALSE;
    END IF;

    -- Отвязываем водителя
    UPDATE public.profiles
    SET organization_id = NULL
    WHERE id = driver_user_id;
    
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Даем права на выполнение функции
GRANT EXECUTE ON FUNCTION public.update_driver_organization(UUID, UUID, TEXT) TO authenticated;

