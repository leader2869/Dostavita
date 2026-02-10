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
