'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        
        // Редиректим сразу после успешной аутентификации
        router.push('/dashboard')
        router.refresh()
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
    <div className="bg-white p-8 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6">Вход в Dostavita</h1>
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <a href="/register" className="text-sm text-blue-600 hover:text-blue-500">
          Нет аккаунта? Зарегистрироваться
        </a>
      </div>
    </div>
  )
}
