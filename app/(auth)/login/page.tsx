'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Проверяем, не авторизован ли уже пользователь
  useEffect(() => {
    const checkAuth = async () => {
      setCheckingAuth(true)
      try {
        const supabase = createClient()

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
        const authPromise = supabase.auth.getUser()
        const { data: { user }, error } = await Promise.race([authPromise, timeoutPromise]) as any

        if (error) {
          // Не показываем ошибку пользователю, просто не редиректим
        } else if (user) {
          window.location.href = '/dashboard'
          return
        }
      } catch (err: any) {
        const msg = err?.message ?? ''
        if (msg.includes('Supabase:') || msg.includes('NEXT_PUBLIC_SUPABASE')) {
          setError('Ключи Supabase не подхватились. Убедитесь, что в .env.local есть NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY. Затем удалите папку .next, перезапустите сервер (npm run dev) и обновите страницу. Проверка: /api/env-check')
        } else if (msg.includes('fetch failed') || msg.includes('Timeout') || msg.includes('Network')) {
          setError('Проблема с подключением к серверу. Проверьте интернет-соединение.')
        }
      } finally {
        setCheckingAuth(false)
      }
    }
    
    // Небольшая задержка для обеспечения правильной гидратации
    const timer = setTimeout(() => {
      checkAuth()
    }, 200)
    
    return () => clearTimeout(timer)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message || 'Ошибка входа. Проверьте email и пароль.')
        setLoading(false)
        return
      }

      if (data.user) {
        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !verifiedUser) {
          setError('Ошибка аутентификации. Попробуйте еще раз.')
          setLoading(false)
          return
        }

        window.location.href = '/dashboard'
      } else {
        setError('Пользователь не найден')
        setLoading(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка входа'
      if (typeof msg === 'string' && (msg.includes('Supabase:') || msg.includes('NEXT_PUBLIC_SUPABASE'))) {
        setError('Ключи Supabase не подхватились. Удалите папку .next и перезапустите: npm run dev. Проверка: /api/env-check')
      } else {
        setError(msg)
      }
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg w-full border border-gray-200">
      <h1 className="text-5xl font-bold text-center mb-6 text-brand-light" style={{ fontFamily: 'var(--font-amatic-sc), cursive' }}>Просто! вход</h1>
      {checkingAuth && (
        <div className="text-center text-gray-600 text-sm mb-4">Проверка аутентификации...</div>
      )}
    
      <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light transition"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-900">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light transition"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || checkingAuth}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-900 bg-brand-light hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-light disabled:opacity-50 transition"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

      <div className="mt-4 text-center">
        <a href="/register" className="text-sm text-brand-light hover:text-brand-dark transition">
          Нет аккаунта? Зарегистрироваться
        </a>
      </div>
    </div>
  )
}
