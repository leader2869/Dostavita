'use client'

import { useState } from 'react'

export function SignOutButton() {
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    try {
      // Выполняем выход через API
      await fetch('/auth/signout', {
        method: 'POST',
        credentials: 'include',
      })
      // Используем window.location для надежного редиректа
      // Добавляем небольшую задержку для завершения запроса
      setTimeout(() => {
        window.location.href = '/login'
      }, 100)
    } catch (error) {
      console.error('Ошибка при выходе:', error)
      // В случае ошибки все равно редиректим на логин
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      {loading ? 'Выход...' : 'Выйти'}
    </button>
  )
}

