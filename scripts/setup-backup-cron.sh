#!/bin/bash
# Скрипт для настройки автоматического резервного копирования через cron

cd "$(dirname "$0")/.."

SCRIPT_DIR="$(pwd)/scripts"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.sh"

# Проверяем, что скрипт существует
if [ ! -f "$BACKUP_SCRIPT" ]; then
  echo "❌ Скрипт $BACKUP_SCRIPT не найден"
  exit 1
fi

# Делаем скрипт исполняемым
chmod +x "$BACKUP_SCRIPT"

# Получаем абсолютный путь к скрипту
ABSOLUTE_SCRIPT_PATH="$(cd "$(dirname "$BACKUP_SCRIPT")" && pwd)/$(basename "$BACKUP_SCRIPT")"

# Создаем cron задачу (ежедневно в 2:00 ночи)
CRON_JOB="0 2 * * * $ABSOLUTE_SCRIPT_PATH >> $(pwd)/backups/backup.log 2>&1"

# Проверяем, не добавлена ли уже задача
if crontab -l 2>/dev/null | grep -q "$ABSOLUTE_SCRIPT_PATH"; then
  echo "⚠️  Задача резервного копирования уже добавлена в cron"
  echo ""
  echo "Текущие задачи cron:"
  crontab -l | grep "$ABSOLUTE_SCRIPT_PATH"
else
  # Добавляем задачу в cron
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo "✅ Задача резервного копирования добавлена в cron"
  echo "   Время выполнения: ежедневно в 2:00 ночи"
fi

echo ""
echo "📋 Для просмотра задач cron:"
echo "   crontab -l"
echo ""
echo "📋 Для удаления задачи:"
echo "   crontab -e"
echo "   (удалите строку с $ABSOLUTE_SCRIPT_PATH)"
echo ""
echo "📋 Для просмотра логов:"
echo "   tail -f $(pwd)/backups/backup.log"

