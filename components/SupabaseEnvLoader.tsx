'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __SUPABASE_ENV__?: { url: string; anonKey: string }
  }
}

/**
 * На клиенте подгружает конфиг Supabase из /api/supabase-config, если он ещё не задан
 * (например, скрипт из layout не сработал). Всегда рендерит children, чтобы не ломать гидрацию.
 */
export function SupabaseEnvLoader({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.__SUPABASE_ENV__?.url && window.__SUPABASE_ENV__?.anonKey) return
    fetch('/api/supabase-config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.url && data?.anonKey) {
          window.__SUPABASE_ENV__ = { url: data.url, anonKey: data.anonKey }
        }
      })
      .catch(() => {})
  }, [])

  return <>{children}</>
}
