#!/bin/bash
# Скрипт для выполнения пересчета балансов через psql
# Требует установленный psql и connection string к Supabase

cd "$(dirname "$0")/.."

# Читаем переменные из .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_URL" ]; then
  echo "❌ SUPABASE_URL не найден в .env.local"
  exit 1
fi

# Извлекаем host из URL
HOST=$(echo $SUPABASE_URL | sed 's|https://||' | sed 's|http://||' | cut -d'/' -f1)

# Для подключения через psql нужен connection string
# Формат: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
# Но пароль нужно получить из Supabase Dashboard -> Settings -> Database

echo "⚠️  Для выполнения SQL через psql нужен пароль базы данных"
echo "📋 Получите connection string из Supabase Dashboard:"
echo "   Settings -> Database -> Connection string"
echo ""
echo "Затем выполните:"
echo "psql '[CONNECTION_STRING]' -f supabase/migrations/102_recalculate_all_balances.sql"
echo ""
echo "Или выполните SQL вручную в Supabase Dashboard -> SQL Editor"

