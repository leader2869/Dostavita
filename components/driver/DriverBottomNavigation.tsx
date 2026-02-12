'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function DriverBottomNavigation() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/dashboard/driver') {
      return pathname === '/dashboard/driver'
    }
    return pathname?.startsWith(path)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="flex justify-around items-center h-16">
        <Link
          href="/dashboard/driver"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/dashboard/driver') ? 'text-green-400' : 'text-gray-400'
          } hover:text-green-400 transition`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span className="text-xs">Главная</span>
        </Link>

        <Link
          href="/dashboard/driver/my-orders"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/dashboard/driver/my-orders') ? 'text-green-400' : 'text-gray-400'
          } hover:text-green-400 transition`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <span className="text-xs">Заказы</span>
        </Link>

        <Link
          href="/dashboard/driver/requests"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/dashboard/driver/requests') ? 'text-green-400' : 'text-gray-400'
          } hover:text-green-400 transition`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="text-xs">Запросы</span>
        </Link>

        <Link
          href="/dashboard/driver/finance"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/dashboard/driver/finance') ? 'text-green-400' : 'text-gray-400'
          } hover:text-green-400 transition`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-xs">Финансы</span>
        </Link>

        <Link
          href="/dashboard/driver/profile"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/dashboard/driver/profile') ? 'text-green-400' : 'text-gray-400'
          } hover:text-green-400 transition`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="text-xs">Профиль</span>
        </Link>
      </div>
    </div>
  )
}

