-- Миграция 110: Создание RLS политик для bucket chat-photos
-- Позволяет водителям и организациям загружать фото в чат
-- 
-- ВАЖНО: Политики для storage.objects должны создаваться через Supabase Dashboard
-- или от имени service_role. Эта миграция содержит SQL для ручного выполнения
-- через Supabase Dashboard -> Storage -> Policies

-- Инструкция по применению:
-- 1. Откройте Supabase Dashboard
-- 2. Перейдите в Storage -> Policies
-- 3. Выберите bucket 'chat-photos'
-- 4. Создайте политики вручную, используя SQL ниже

-- ============================================
-- ПОЛИТИКА 1: Водители могут загружать фото
-- ============================================
-- Название: Drivers can upload chat photos
-- Тип: INSERT
-- Target roles: authenticated
-- USING expression: (пусто)
-- WITH CHECK expression:
/*
(
  bucket_id = 'chat-photos'
  AND name LIKE 'driver-org-chat/%'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'driver'
      AND p.organization_id IS NOT NULL
      AND (
        name LIKE 'driver-org-chat/' || p.organization_id::text || '/general/%'
        OR
        name LIKE 'driver-org-chat/' || p.organization_id::text || '/' || auth.uid()::text || '/%'
      )
  )
)
*/

-- ============================================
-- ПОЛИТИКА 2: Организации могут загружать фото
-- ============================================
-- Название: Organizations can upload chat photos
-- Тип: INSERT
-- Target roles: authenticated
-- USING expression: (пусто)
-- WITH CHECK expression:
/*
(
  bucket_id = 'chat-photos'
  AND name LIKE 'driver-org-chat/%'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'customer'
      AND (
        name LIKE 'driver-org-chat/' || auth.uid()::text || '/general/%'
        OR
        (
          name LIKE 'driver-org-chat/' || auth.uid()::text || '/%'
          AND EXISTS (
            SELECT 1 FROM public.profiles d
            WHERE d.organization_id = auth.uid()
              AND name LIKE 'driver-org-chat/' || auth.uid()::text || '/' || d.id::text || '/%'
          )
        )
      )
  )
)
*/

-- ============================================
-- ПОЛИТИКА 3: Пользователи могут просматривать фото
-- ============================================
-- Название: Users can view chat photos
-- Тип: SELECT
-- Target roles: authenticated
-- USING expression:
/*
(
  bucket_id = 'chat-photos'
  AND name LIKE 'driver-org-chat/%'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'driver'
        AND p.organization_id IS NOT NULL
        AND (
          name LIKE 'driver-org-chat/' || p.organization_id::text || '/general/%'
          OR
          name LIKE 'driver-org-chat/' || p.organization_id::text || '/' || auth.uid()::text || '/%'
        )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'customer'
        AND (
          name LIKE 'driver-org-chat/' || auth.uid()::text || '/general/%'
          OR
          (
            name LIKE 'driver-org-chat/' || auth.uid()::text || '/%'
            AND EXISTS (
              SELECT 1 FROM public.profiles d
              WHERE d.organization_id = auth.uid()
                AND name LIKE 'driver-org-chat/' || auth.uid()::text || '/' || d.id::text || '/%'
            )
          )
        )
    )
  )
)
*/
-- WITH CHECK expression: (пусто)

-- ============================================
-- ПОЛИТИКА 4: Пользователи могут удалять свои фото
-- ============================================
-- Название: Users can delete own chat photos
-- Тип: DELETE
-- Target roles: authenticated
-- USING expression:
/*
(
  bucket_id = 'chat-photos'
  AND owner = auth.uid()
)
*/
-- WITH CHECK expression: (пусто)

-- ============================================
-- АЛЬТЕРНАТИВНЫЙ ВАРИАНТ: Использование функции
-- ============================================
-- Если у вас есть доступ к service_role, можно использовать эту функцию:

CREATE OR REPLACE FUNCTION create_chat_photos_storage_policies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  -- Политика для загрузки водителями
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Drivers can upload chat photos'
  ) THEN
    EXECUTE '
      CREATE POLICY "Drivers can upload chat photos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = ''chat-photos''
        AND name LIKE ''driver-org-chat/%''
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = ''driver''
            AND p.organization_id IS NOT NULL
            AND (
              name LIKE ''driver-org-chat/'' || p.organization_id::text || ''/general/%''
              OR
              name LIKE ''driver-org-chat/'' || p.organization_id::text || ''/'' || auth.uid()::text || ''/%''
            )
        )
      )
    ';
  END IF;

  -- Политика для загрузки организациями
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Organizations can upload chat photos'
  ) THEN
    EXECUTE '
      CREATE POLICY "Organizations can upload chat photos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = ''chat-photos''
        AND name LIKE ''driver-org-chat/%''
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = ''customer''
            AND (
              name LIKE ''driver-org-chat/'' || auth.uid()::text || ''/general/%''
              OR
              (
                name LIKE ''driver-org-chat/'' || auth.uid()::text || ''/%''
                AND EXISTS (
                  SELECT 1 FROM public.profiles d
                  WHERE d.organization_id = auth.uid()
                    AND name LIKE ''driver-org-chat/'' || auth.uid()::text || ''/'' || d.id::text || ''/%''
                )
              )
            )
        )
      )
    ';
  END IF;

  -- Политика для просмотра
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view chat photos'
  ) THEN
    EXECUTE '
      CREATE POLICY "Users can view chat photos"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = ''chat-photos''
        AND name LIKE ''driver-org-chat/%''
        AND (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = ''driver''
              AND p.organization_id IS NOT NULL
              AND (
                name LIKE ''driver-org-chat/'' || p.organization_id::text || ''/general/%''
                OR
                name LIKE ''driver-org-chat/'' || p.organization_id::text || ''/'' || auth.uid()::text || ''/%''
              )
          )
          OR
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = ''customer''
              AND (
                name LIKE ''driver-org-chat/'' || auth.uid()::text || ''/general/%''
                OR
                (
                  name LIKE ''driver-org-chat/'' || auth.uid()::text || ''/%''
                  AND EXISTS (
                    SELECT 1 FROM public.profiles d
                    WHERE d.organization_id = auth.uid()
                      AND name LIKE ''driver-org-chat/'' || auth.uid()::text || ''/'' || d.id::text || ''/%''
                  )
                )
              )
          )
        )
      )
    ';
  END IF;

  -- Политика для удаления
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own chat photos'
  ) THEN
    EXECUTE '
      CREATE POLICY "Users can delete own chat photos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = ''chat-photos''
        AND owner = auth.uid()
      )
    ';
  END IF;
END;
$$;

-- Выполняем функцию (требует прав суперпользователя или service_role)
-- SELECT create_chat_photos_storage_policies();

COMMENT ON FUNCTION create_chat_photos_storage_policies() IS 
  'Создает RLS политики для bucket chat-photos. Требует выполнения от имени service_role или суперпользователя.';

