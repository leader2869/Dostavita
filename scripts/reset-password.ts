/**
 * Скрипт для сброса пароля пользователя
 * Использование: npx tsx scripts/reset-password.ts <email>
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Загружаем переменные окружения из .env.local
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const envFile = readFileSync(envPath, 'utf-8')
    const lines = envFile.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
          process.env[key.trim()] = value
        }
      }
    }
  } catch (error) {
    console.warn('Не удалось загрузить .env.local, используем переменные окружения системы')
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Ошибка: NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть установлены в переменных окружения')
  process.exit(1)
}

const email = process.argv[2]

if (!email) {
  console.error('Использование: npx tsx scripts/reset-password.ts <email>')
  process.exit(1)
}

async function resetPassword() {
  // Создаем клиент с service role key для доступа к admin API
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    console.log(`Сброс пароля для пользователя: ${email}`)

    // Генерируем ссылку для сброса пароля
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    })

    if (error) {
      console.error('Ошибка при генерации ссылки для сброса пароля:', error)
      process.exit(1)
    }

    if (data?.properties?.action_link) {
      console.log('\n✅ Ссылка для сброса пароля сгенерирована:')
      console.log(data.properties.action_link)
      console.log('\nОтправьте эту ссылку пользователю для сброса пароля.')
    } else {
      console.error('Ошибка: ссылка для сброса пароля не была сгенерирована')
      process.exit(1)
    }
  } catch (err: any) {
    console.error('Ошибка при сбросе пароля:', err.message)
    process.exit(1)
  }
}

resetPassword()

