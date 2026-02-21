# Настройка двойного деплоя: автоматический на Vercel, ручной на основной домен

## Вариант 1: Использовать "Promote to Production" (Рекомендуется)

Это самый простой способ - автоматический деплой на preview домен, ручной промоушн на production.

### Настройка:

1. **В Vercel Dashboard → Settings → Domains:**
   - `dostavita.vercel.app` - оставьте как есть (это preview домен)
   - `prosto.of.by` - отметьте как **Production Domain**

2. **Настройка автоматического деплоя:**
   - По умолчанию Vercel автоматически деплоит на `dostavita.vercel.app` при каждом push в `main`
   - Это уже работает автоматически

3. **Ручной деплой на основной домен:**
   - После каждого автоматического деплоя на `dostavita.vercel.app`
   - Откройте Vercel Dashboard → Deployments
   - Найдите нужный деплой
   - Нажмите "..." → **Promote to Production**
   - Это обновит `prosto.of.by` вручную

## Вариант 2: Использовать разные ветки

### Настройка:

1. **Создайте ветку `production`:**
   ```bash
   git checkout -b production
   git push origin production
   ```

2. **В Vercel Dashboard → Settings → Git:**
   - Production Branch: `production` (вместо `main`)
   - Preview Branches: `main` (для автоматического деплоя на `dostavita.vercel.app`)

3. **Настройка доменов:**
   - `dostavita.vercel.app` → привязан к ветке `main` (автоматический деплой)
   - `prosto.of.by` → привязан к ветке `production` (ручной деплой через merge)

4. **Процесс работы:**
   - Push в `main` → автоматический деплой на `dostavita.vercel.app`
   - Когда готово → merge `main` в `production` → деплой на `prosto.of.by`

## Вариант 3: Два отдельных проекта в Vercel

### Настройка:

1. **Создайте второй проект в Vercel:**
   - Project 1: "Dostavita Dev" → `dostavita.vercel.app` → автоматический деплой
   - Project 2: "Dostavita Production" → `prosto.of.by` → ручной деплой

2. **Настройка автоматического деплоя (Dev):**
   - Подключите репозиторий к Project 1
   - Автоматический деплой при push в `main`

3. **Настройка ручного деплоя (Production):**
   - Подключите тот же репозиторий к Project 2
   - Отключите автоматический деплой
   - Деплой только вручную через Dashboard или CLI

## Рекомендация: Вариант 1

**Используйте "Promote to Production"** - это самый простой и удобный способ:

### Преимущества:
- ✅ Один проект, одна настройка
- ✅ Автоматический деплой на preview домен
- ✅ Ручной контроль над production доменом
- ✅ Можно тестировать на `dostavita.vercel.app` перед промоушном

### Процесс работы:

1. **Разработка:**
   ```bash
   git add .
   git commit -m "Новые изменения"
   git push origin main
   ```
   → Автоматический деплой на `dostavita.vercel.app`

2. **Тестирование:**
   - Откройте `https://dostavita.vercel.app`
   - Проверьте все функции

3. **Ручной деплой на production:**
   - Vercel Dashboard → Deployments
   - Найдите последний деплой
   - "..." → **Promote to Production**
   → Обновление `prosto.of.by`

## Настройка в Vercel Dashboard

### Шаг 1: Отключить автоматический деплой на production домен

1. Settings → Git
2. Production Branch: `main` (оставьте)
3. **Важно:** В настройках деплоя можно настроить, чтобы production домен обновлялся только вручную

### Шаг 2: Настроить домены

1. Settings → Domains
2. `dostavita.vercel.app` - автоматический деплой (по умолчанию)
3. `prosto.of.by` - только через "Promote to Production"

## Альтернатива: Использовать Vercel CLI для ручного деплоя

Если хотите полностью ручной контроль:

```bash
# Установить Vercel CLI
npm i -g vercel

# Логин
vercel login

# Деплой на production домен
vercel --prod
```

Но это требует дополнительной настройки.

## Итоговая рекомендация

**Используйте Вариант 1** с функцией "Promote to Production":
- Просто и удобно
- Автоматический деплой на preview
- Ручной контроль над production
- Можно тестировать перед промоушном

