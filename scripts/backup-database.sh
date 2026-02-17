#!/bin/bash
# Скрипт для резервного копирования базы данных Supabase и отправки на почту

set -e

cd "$(dirname "$0")/.."

# Загружаем переменные окружения
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
BACKUP_EMAIL="${BACKUP_EMAIL:-}"  # Email для отправки бэкапов

# Проверяем наличие необходимых переменных
if [ -z "$SUPABASE_URL" ]; then
  echo "❌ SUPABASE_URL не найден в .env.local"
  exit 1
fi

# Создаем директорию для бэкапов
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Имя файла бэкапа с датой и временем
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/dostavita_backup_$TIMESTAMP.sql"
BACKUP_FILE_ZIP="$BACKUP_FILE.gz"

# Извлекаем host из URL
HOST=$(echo $SUPABASE_URL | sed 's|https://||' | sed 's|http://||' | cut -d'/' -f1)
PROJECT_REF=$(echo $HOST | cut -d'.' -f1)

echo "📦 Начинаем резервное копирование базы данных..."
echo "   Project: $PROJECT_REF"
echo "   Host: $HOST"

# Проверяем наличие pg_dump
if ! command -v pg_dump &> /dev/null; then
  echo "⚠️  pg_dump не найден. Устанавливаем через Homebrew..."
  if command -v brew &> /dev/null; then
    brew install postgresql@15 || brew install postgresql
  else
    echo "❌ Homebrew не установлен. Установите pg_dump вручную."
    exit 1
  fi
fi

# Для подключения через pg_dump нужен connection string
# Получите его из Supabase Dashboard -> Settings -> Database -> Connection string
# Формат: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

DB_CONNECTION_STRING="${SUPABASE_DB_CONNECTION_STRING:-}"

if [ -z "$DB_CONNECTION_STRING" ]; then
  echo "⚠️  SUPABASE_DB_CONNECTION_STRING не найден в .env.local"
  echo ""
  echo "📋 Для автоматического бэкапа нужно добавить connection string:"
  echo "   1. Откройте Supabase Dashboard"
  echo "   2. Settings -> Database"
  echo "   3. Connection string -> Connection pooling (Session mode)"
  echo "   4. Скопируйте строку подключения"
  echo "   5. Добавьте в .env.local:"
  echo "      SUPABASE_DB_CONNECTION_STRING='postgresql://postgres.[PROJECT_REF]:[PASSWORD]@...'"
  echo ""
  echo "💡 Альтернатива: используйте Supabase CLI для бэкапа"
  echo "   npx supabase db dump -f $BACKUP_FILE"
  exit 1
fi

# Делаем дамп базы данных
echo "🔄 Создаем дамп базы данных..."
pg_dump "$DB_CONNECTION_STRING" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --format=plain \
  --file="$BACKUP_FILE" 2>&1 | grep -v "WARNING" || true

if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
  echo "❌ Ошибка создания дампа базы данных"
  exit 1
fi

# Сжимаем файл
echo "🗜️  Сжимаем файл бэкапа..."
gzip -f "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE_ZIP"

# Проверяем размер файла
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Бэкап создан: $BACKUP_FILE ($FILE_SIZE)"

# Отправляем на почту, если указан email
if [ -n "$BACKUP_EMAIL" ]; then
  echo "📧 Отправляем бэкап на $BACKUP_EMAIL..."
  
  # Проверяем наличие mail или sendmail
  if command -v mail &> /dev/null; then
    echo "Резервная копия базы данных Dostavita от $(date +"%Y-%m-%d %H:%M:%S")" | \
      mail -s "Dostavita DB Backup - $(date +"%Y-%m-%d")" \
           -A "$BACKUP_FILE" \
           "$BACKUP_EMAIL"
    echo "✅ Бэкап отправлен на почту"
  elif command -v sendmail &> /dev/null; then
    # Используем sendmail
    (
      echo "To: $BACKUP_EMAIL"
      echo "Subject: Dostavita DB Backup - $(date +"%Y-%m-%d")"
      echo "Content-Type: application/gzip"
      echo "Content-Disposition: attachment; filename=\"$(basename $BACKUP_FILE)\""
      echo ""
      cat "$BACKUP_FILE" | base64
    ) | sendmail "$BACKUP_EMAIL"
    echo "✅ Бэкап отправлен на почту через sendmail"
  else
    echo "⚠️  mail или sendmail не найдены. Установите один из них для отправки на почту."
    echo "   macOS: brew install mailutils"
    echo "   Или используйте альтернативный способ отправки (см. backup-database-node.js)"
  fi
else
  echo "ℹ️  BACKUP_EMAIL не указан. Бэкап сохранен локально: $BACKUP_FILE"
fi

# Удаляем старые бэкапы (оставляем последние 7 дней)
echo "🧹 Удаляем старые бэкапы (старше 7 дней)..."
find "$BACKUP_DIR" -name "dostavita_backup_*.sql.gz" -mtime +7 -delete 2>/dev/null || true

echo "✅ Резервное копирование завершено!"

