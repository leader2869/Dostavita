'use client'

import { useEffect } from 'react'

/**
 * Глобальный обработчик ошибок. Не используем useRouter/usePathname,
 * чтобы избежать "Cannot read properties of null (reading 'useContext')"
 * при падении до инициализации контекста навигации.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111', marginBottom: 8 }}>
        Что-то пошло не так
      </h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Произошла ошибка. Попробуйте обновить страницу.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: '12px 24px', background: '#87CEEB', color: '#111', fontWeight: 600, border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Обновить
        </button>
        <a
          href="/login"
          style={{ padding: '12px 24px', border: '1px solid #ccc', color: '#333', borderRadius: 8, textDecoration: 'none' }}
        >
          На страницу входа
        </a>
      </div>
    </div>
  )
}
