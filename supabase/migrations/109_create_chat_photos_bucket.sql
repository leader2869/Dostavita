-- Миграция 109: Создание bucket для фото чата между водителем и организацией

-- Создаем bucket для фото чата
-- Название: chat-photos
-- Публичный: Да
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- Эта миграция служит только как документация
-- Bucket должен быть создан вручную через Supabase Dashboard:
-- 1. Storage -> Create a new bucket
-- 2. Name: chat-photos
-- 3. Public bucket: Yes
-- 4. File size limit: 5MB
-- 5. Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- RLS политики для bucket (если нужны ограничения):
-- Водители могут загружать фото в папку своей организации
-- Организации могут загружать фото в папку своих водителей

