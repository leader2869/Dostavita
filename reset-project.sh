#!/bin/bash

# ⚠️ ВНИМАНИЕ: Этот скрипт полностью очищает проект, но сохраняет:
# - .git (связь с GitHub)
# - .env.local (ключи Supabase)
# - Базовые конфиги (package.json, tsconfig.json, и т.д.)

set -e  # Остановить при ошибке

echo "=========================================="
echo "🔄 Очистка проекта для начала с нуля"
echo "=========================================="
echo ""
echo "⚠️  ВНИМАНИЕ: Этот скрипт удалит:"
echo "   - Все файлы приложения (app/, components/, hooks/, lib/, и т.д.)"
echo "   - Все миграции базы данных"
echo "   - Все документацию (кроме README.md)"
echo ""
echo "✅ Будет сохранено:"
echo "   - .git (связь с GitHub)"
echo "   - .env.local (ключи Supabase)"
echo "   - Базовые конфиги (package.json, tsconfig.json, и т.д.)"
echo "   - node_modules (зависимости)"
echo ""
read -p "Продолжить? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Отменено"
    exit 1
fi

echo ""
echo "🧹 Начинаем очистку..."

# Удаляем директории с кодом
echo "   Удаляем app/..."
rm -rf app/

echo "   Удаляем components/..."
rm -rf components/

echo "   Удаляем hooks/..."
rm -rf hooks/

echo "   Удаляем lib/..."
rm -rf lib/

echo "   Удаляем types/..."
rm -rf types/

echo "   Удаляем public/..."
rm -rf public/

echo "   Удаляем supabase/migrations/..."
rm -rf supabase/migrations/

# Удаляем документацию (кроме README.md)
echo "   Удаляем документацию..."
find . -maxdepth 1 -type f \( -name "*.md" ! -name "README.md" ! -name ".gitignore" \) -delete

# Удаляем другие файлы
echo "   Удаляем другие файлы..."
rm -f next-env.d.ts
rm -f vercel.json

# Создаем минимальную структуру Next.js
echo ""
echo "📁 Создаем минимальную структуру..."

# Создаем базовую структуру app
mkdir -p app
mkdir -p public

# Создаем минимальный layout.tsx
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dostavita',
  description: 'Платформа для службы доставки',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
EOF

# Создаем минимальный page.tsx
cat > app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Добро пожаловать в Dostavita</h1>
        <p className="text-gray-600">Проект готов к разработке</p>
      </div>
    </main>
  )
}
EOF

# Создаем globals.css
cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}
EOF

# Создаем пустую директорию для миграций
mkdir -p supabase/migrations

# Создаем README для миграций
cat > supabase/migrations/README.md << 'EOF'
# Миграции базы данных

Здесь будут храниться SQL миграции для Supabase.

## Как применить миграции:

1. Откройте Supabase Dashboard
2. Перейдите в SQL Editor
3. Скопируйте содержимое миграции
4. Выполните в SQL Editor
EOF

# Обновляем README.md
cat > README.md << 'EOF'
# Dostavita

Платформа для службы доставки.

## 🚀 Начало работы

Проект очищен и готов к разработке с нуля.

### Предварительные требования

- Node.js 18+
- Аккаунт Supabase (уже настроен)
- Аккаунт GitHub (уже настроен)

### Установка

```bash
# Установка зависимостей (если еще не установлены)
npm install
```

### Переменные окружения

Файл `.env.local` уже настроен с ключами Supabase. Убедитесь, что он содержит:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Запуск

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## 📝 Следующие шаги

1. Создайте схему базы данных в `supabase/migrations/`
2. Настройте аутентификацию
3. Начните разработку функционала

## 🔗 Полезные ссылки

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
EOF

echo ""
echo "✅ Очистка завершена!"
echo ""
echo "📋 Что дальше:"
echo "   1. Проверьте, что .env.local содержит ключи Supabase"
echo "   2. Очистите базу данных Supabase (выполните 000_drop_all.sql в SQL Editor)"
echo "   3. Начните разработку с нуля!"
echo ""
echo "💡 Полезные команды:"
echo "   npm run dev          - Запуск dev сервера"
echo "   npm run build        - Сборка проекта"
echo "   npm run lint         - Проверка кода"
echo ""

