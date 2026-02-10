'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'customer' | 'driver'>('customer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      // Регистрируем пользователя
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            role: role,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (data.user) {
        // Проверяем, существует ли профиль, и создаем/обновляем его
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single()

        if (existingProfile) {
          // Профиль существует, обновляем
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              full_name: fullName,
              phone: phone,
              role: role,
            })
            .eq('id', data.user.id)

          if (profileError) {
            console.error('Ошибка обновления профиля:', profileError)
          }
        } else {
          // Профиль не существует, создаем
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: data.user.email || email,
              full_name: fullName,
              phone: phone,
              role: role,
            })

          if (profileError) {
            console.error('Ошибка создания профиля:', profileError)
          }

          // Создаем баланс, если его нет
          const { error: balanceError } = await supabase
            .from('balances')
            .upsert({
              user_id: data.user.id,
              amount: 0.00,
              currency: 'BYN',
            })

          if (balanceError) {
            console.error('Ошибка создания баланса:', balanceError)
          }
        }

        // Проверяем, что пользователь аутентифицирован
        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !verifiedUser) {
          // Пользователь не аутентифицирован - возможно требуется подтверждение email
          setError('Регистрация успешна, но требуется подтверждение email. Проверьте почту или войдите через логин.')
          setLoading(false)
          return
        }

        // Пользователь аутентифицирован, переходим в дашборд
        await new Promise(resolve => setTimeout(resolve, 100))
        router.push('/dashboard')
        router.refresh()
      } else {
        setError('Не удалось создать пользователя')
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6">Регистрация в Dostavita</h1>
      
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            ФИО
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Телефон
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

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
            minLength={6}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700">
            Роль
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'customer' | 'driver')}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="customer">Заказчик</option>
            <option value="driver">Исполнитель (Водитель)</option>
          </select>
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <a href="/login" className="text-sm text-blue-600 hover:text-blue-500">
          Уже есть аккаунт? Войти
        </a>
      </div>
    </div>
  )
}
