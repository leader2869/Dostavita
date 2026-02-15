'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(false)

  useEffect(() => {
    // Проверяем параметр signedOut в URL и очищаем его
    const signedOut = searchParams.get('signedOut')
    if (signedOut === 'true' && typeof window !== 'undefined') {
      // Очищаем параметр из URL без перезагрузки через history API
      const url = new URL(window.location.href)
      url.searchParams.delete('signedOut')
      window.history.replaceState({}, '', url.toString())
    }

    // Проверяем, не авторизован ли уже пользователь
    const checkAuth = async () => {
      setCheckingAuth(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Используем window.location для надежного редиректа
          window.location.href = '/dashboard'
          return
        }
      } catch (err) {
        console.error('Ошибка при проверке аутентификации:', err)
      } finally {
        setCheckingAuth(false)
      }
    }
    
    // Небольшая задержка для обеспечения правильной гидратации
    const timer = setTimeout(() => {
      checkAuth()
    }, 200)
    
    return () => clearTimeout(timer)
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      console.log('Начинаем вход...')
      const supabase = createClient()
      
      console.log('Вызываем signInWithPassword...')
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('Результат signInWithPassword:', { hasUser: !!data?.user, error: signInError?.message })

      if (signInError) {
        console.error('Ошибка входа:', signInError)
        setError(signInError.message || 'Ошибка входа. Проверьте email и пароль.')
        setLoading(false)
        return
      }

      if (data.user) {
        console.log('Пользователь найден, проверяем getUser()...')
        
        // Проверяем, что пользователь аутентифицирован
        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
        console.log('Результат getUser():', { hasUser: !!verifiedUser, error: userError?.message })
        
        if (userError || !verifiedUser) {
          console.error('Ошибка getUser():', userError)
          setError('Ошибка аутентификации. Попробуйте еще раз.')
          setLoading(false)
          return
        }

        console.log('Аутентификация успешна, переходим в дашборд...')
        console.log('User ID:', verifiedUser.id)
        
        // Используем window.location для полной перезагрузки страницы
        window.location.href = '/dashboard'
      } else {
        console.error('Пользователь не найден в data')
        setError('Пользователь не найден')
        setLoading(false)
      }
    } catch (err: any) {
      console.error('Исключение при входе:', err)
      setError(err.message || 'Ошибка входа')
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-md w-full">
      <h1 className="text-2xl font-bold text-center mb-6 text-white">Вход в Dostavita</h1>
      {checkingAuth && (
        <div className="text-center text-gray-400 text-sm mb-4">Проверка аутентификации...</div>
      )}
    
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
          />
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900 bg-opacity-30 p-3 rounded border border-red-800">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <a href="/register" className="text-sm text-green-500 hover:text-green-500">
          Нет аккаунта? Зарегистрироваться
        </a>
      </div>
    </div>
  )
}
