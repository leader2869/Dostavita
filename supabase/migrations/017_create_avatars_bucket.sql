-- Миграция 017: Создание bucket для аватаров в Supabase Storage
-- Примечание: Создание bucket через SQL не поддерживается напрямую
-- Bucket будет создан автоматически через API при первой загрузке
-- Или создайте его вручную в Supabase Dashboard: Storage -> Create bucket
-- Название: avatars
-- Публичный: Да
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- Эта миграция служит только как документация
-- Bucket создается автоматически в API route /api/profile/upload-avatar






