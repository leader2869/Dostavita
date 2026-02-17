# Резервное копирование базы данных

## Настройка

### 1. Получите Connection String из Supabase

1. Откройте Supabase Dashboard
2. Settings -> Database
3. Connection string -> **Connection pooling** (Session mode)
4. Скопируйте строку подключения

### 2. Добавьте переменные в `.env.local`

```bash
# Connection string для бэкапа (из Supabase Dashboard)
SUPABASE_DB_CONNECTION_STRING='postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres'

# Email для отправки бэкапов
BACKUP_EMAIL='your-email@example.com'

# Настройки SMTP (для отправки на почту через Node.js скрипт)
SMTP_HOST='smtp.gmail.com'
SMTP_PORT=587
SMTP_USER='your-email@gmail.com'
SMTP_PASSWORD='your-app-password'  # Для Gmail нужен App Password
```

### 3. Выберите способ выполнения

#### Вариант A: Bash скрипт (рекомендуется)

```bash
# Делаем скрипт исполняемым
chmod +x scripts/backup-database.sh

# Запускаем вручную для теста
./scripts/backup-database.sh

# Настраиваем автоматическое выполнение (ежедневно в 2:00)
./scripts/setup-backup-cron.sh
```

#### Вариант B: Node.js скрипт (требует nodemailer)

```bash
# Устанавливаем зависимости
npm install nodemailer

# Запускаем вручную
node scripts/backup-database-node.js

# Настраиваем автоматическое выполнение
# Добавьте в crontab:
# 0 2 * * * cd /path/to/Dostavita && node scripts/backup-database-node.js >> backups/backup.log 2>&1
```

## Автоматическое выполнение

### Через cron (macOS/Linux)

```bash
# Настройка автоматического выполнения
./scripts/setup-backup-cron.sh

# Просмотр задач
crontab -l

# Редактирование задач
crontab -e
```

### Через launchd (macOS)

Создайте файл `~/Library/LaunchAgents/com.dostavita.backup.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.dostavita.backup</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/Dostavita/scripts/backup-database.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/path/to/Dostavita/backups/backup.log</string>
  <key>StandardErrorPath</key>
  <string>/path/to/Dostavita/backups/backup-error.log</string>
</dict>
</plist>
```

Загрузите задачу:
```bash
launchctl load ~/Library/LaunchAgents/com.dostavita.backup.plist
```

## Где хранятся бэкапы

- Локально: `./backups/dostavita_backup_YYYYMMDD_HHMMSS.sql.gz`
- Автоматически удаляются через 7 дней

## Проверка работы

```bash
# Просмотр последних бэкапов
ls -lh backups/

# Просмотр логов
tail -f backups/backup.log

# Тест восстановления (опционально)
gunzip -c backups/dostavita_backup_*.sql.gz | psql "[CONNECTION_STRING]"
```

## Устранение проблем

### pg_dump не найден
```bash
# macOS
brew install postgresql@15

# Linux
sudo apt-get install postgresql-client
```

### Ошибка подключения к БД
- Проверьте правильность `SUPABASE_DB_CONNECTION_STRING`
- Убедитесь, что используете Connection pooling (Session mode)
- Проверьте, что пароль правильный

### Письма не отправляются
- Для Gmail: используйте App Password (не обычный пароль)
- Проверьте настройки SMTP в `.env.local`
- Проверьте логи: `tail -f backups/backup.log`

