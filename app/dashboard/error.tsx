'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Логируем ошибку в консоль (в проде можно отправить в сервис мониторинга)
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Что-то пошло не так
        </h1>
        <p className="text-gray-600 mb-6">
          Произошла ошибка при загрузке страницы. Попробуйте обновить страницу или вернуться позже.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-3 bg-[var(--brand-color)] text-gray-900 font-semibold rounded-lg hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-color)]"
          >
            Обновить
          </button>
          <a
            href="/login"
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
          >
            На страницу входа
          </a>
        </div>
      </div>
    </div>
  )
}
