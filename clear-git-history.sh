#!/bin/bash

# ⚠️ ВНИМАНИЕ: Этот скрипт полностью очищает историю Git, но сохраняет связь с GitHub
# ⚠️ ВСЯ ИСТОРИЯ КОММИТОВ БУДЕТ УДАЛЕНА
# ⚠️ ЭТО ДЕЙСТВИЕ НЕОБРАТИМО!

set -e  # Остановить при ошибке

echo "=========================================="
echo "🔄 Очистка истории Git"
echo "=========================================="
echo ""
echo "⚠️  ВНИМАНИЕ: Этот скрипт:"
echo "   - Удалит ВСЮ историю коммитов"
echo "   - Создаст новый начальный коммит"
echo "   - Удалит все ветки кроме main/master"
echo "   - Сделает force push на GitHub"
echo ""
echo "✅ Будет сохранено:"
echo "   - Связь с GitHub (remote)"
echo "   - Все файлы проекта"
echo "   - .gitignore"
echo ""
read -p "Продолжить? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Отменено"
    exit 1
fi

echo ""
echo "🔍 Проверяем текущее состояние..."

# Проверяем, что мы в git репозитории
if [ ! -d ".git" ]; then
    echo "❌ Ошибка: это не git репозиторий"
    exit 1
fi

# Получаем информацию о remote
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
    echo "⚠️  ВНИМАНИЕ: Не найден remote 'origin'"
    echo "   Связь с GitHub не будет сохранена"
    read -p "Продолжить без remote? (yes/no): " continue_without_remote
    if [ "$continue_without_remote" != "yes" ]; then
        echo "❌ Отменено"
        exit 1
    fi
    REMOTE_EXISTS=false
else
    echo "✅ Найден remote: $REMOTE_URL"
    REMOTE_EXISTS=true
fi

# Определяем текущую ветку
CURRENT_BRANCH=$(git branch --show-current)
echo "📌 Текущая ветка: $CURRENT_BRANCH"

echo ""
echo "🧹 Начинаем очистку..."

# Сохраняем .gitignore если он есть
if [ -f ".gitignore" ]; then
    echo "   Сохраняем .gitignore..."
    cp .gitignore .gitignore.backup
fi

# Удаляем все файлы из индекса
echo "   Удаляем все файлы из индекса..."
git rm -rf --cached . 2>/dev/null || true

# Удаляем историю
echo "   Удаляем историю Git..."
rm -rf .git

# Инициализируем новый репозиторий
echo "   Инициализируем новый репозиторий..."
git init

# Восстанавливаем .gitignore
if [ -f ".gitignore.backup" ]; then
    echo "   Восстанавливаем .gitignore..."
    mv .gitignore.backup .gitignore
fi

# Настраиваем начальную ветку (main или master)
echo "   Настраиваем начальную ветку..."
git branch -M main 2>/dev/null || git branch -M master

# Добавляем все файлы
echo "   Добавляем все файлы..."
git add .

# Создаем начальный коммит
echo "   Создаем начальный коммит..."
git commit -m "Initial commit - проект с нуля"

# Восстанавливаем remote если он был
if [ "$REMOTE_EXISTS" = true ]; then
    echo "   Восстанавливаем связь с GitHub..."
    git remote add origin "$REMOTE_URL"
    
    echo ""
    echo "📤 Готово к отправке на GitHub"
    echo ""
    echo "⚠️  ВНИМАНИЕ: Следующий шаг сделает FORCE PUSH"
    echo "   Это перезапишет всю историю на GitHub!"
    echo ""
    read -p "Отправить на GitHub? (yes/no): " push_confirm
    
    if [ "$push_confirm" = "yes" ]; then
        echo "   Отправляем на GitHub..."
        git push -f --set-upstream origin main 2>/dev/null || git push -f --set-upstream origin master
        
        echo ""
        echo "✅ История Git очищена и отправлена на GitHub!"
    else
        echo ""
        echo "✅ История Git очищена локально"
        echo "   Для отправки на GitHub выполните:"
        echo "   git push -f --set-upstream origin main"
    fi
else
    echo ""
    echo "✅ История Git очищена локально"
    echo "   Для связи с GitHub выполните:"
    echo "   git remote add origin <your-github-url>"
    echo "   git push -f --set-upstream origin main"
fi

echo ""
echo "📋 Текущее состояние:"
echo "   Ветка: $(git branch --show-current)"
echo "   Коммитов: $(git rev-list --count HEAD)"
if [ "$REMOTE_EXISTS" = true ]; then
    echo "   Remote: $REMOTE_URL"
fi
echo ""

