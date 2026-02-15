#!/usr/bin/env node

/**
 * Скрипт для генерации VAPID ключей для push-уведомлений
 * 
 * Использование:
 *   node scripts/generate-vapid-keys.js
 * 
 * Или через npm:
 *   npm run generate-vapid-keys
 */

const webpush = require('web-push')

console.log('🔑 Генерация VAPID ключей для push-уведомлений...\n')

// Генерируем VAPID ключи
const vapidKeys = webpush.generateVAPIDKeys()

console.log('✅ VAPID ключи успешно сгенерированы!\n')
console.log('📋 Добавьте следующие переменные в ваш .env.local:\n')
console.log('='.repeat(60))
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + vapidKeys.publicKey)
console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey)
console.log('='.repeat(60))
console.log('\n📝 Примечания:')
console.log('1. NEXT_PUBLIC_VAPID_PUBLIC_KEY - публичный ключ (используется на клиенте)')
console.log('2. VAPID_PRIVATE_KEY - приватный ключ (используется на сервере для отправки уведомлений)')
console.log('3. НЕ коммитьте приватный ключ в Git!')
console.log('4. После добавления переменных перезапустите сервер разработки')
console.log('\n💡 Для отправки push-уведомлений с сервера используйте библиотеку web-push:')
console.log('   npm install web-push')
console.log('   const webpush = require("web-push")')
console.log('   webpush.setVapidDetails("mailto:your-email@example.com", publicKey, privateKey)')

