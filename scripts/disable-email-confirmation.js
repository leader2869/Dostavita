// Скрипт для отключения подтверждения email через Supabase Management API
// Требуется: SUPABASE_SERVICE_ROLE_KEY и SUPABASE_PROJECT_REF

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'your-project-ref'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Ошибка: SUPABASE_SERVICE_ROLE_KEY не установлен')
  process.exit(1)
}

async function disableEmailConfirmation() {
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ENABLE_SIGNUP: true,
          ENABLE_EMAIL_SIGNUP: true,
          ENABLE_EMAIL_CONFIRMATIONS: false,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ошибка API: ${response.status} - ${error}`)
    }

    const data = await response.json()
    console.log('✅ Подтверждение email отключено')
    console.log('Настройки:', data)
  } catch (error) {
    console.error('❌ Ошибка:', error.message)
    console.log('\n💡 Используйте Способ 1 (через Dashboard) - это проще и надежнее')
  }
}

disableEmailConfirmation()



