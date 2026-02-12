'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function CustomerBottomNavigation() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/dashboard/customer') {
      return pathname === '/dashboard/customer'
    }
    return pathname?.startsWith(path)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="flex justify-around items-center h-16">
        <Link
          href="/dashboard/customer"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/dashboard/customer') ? 'text-green-400' : 'text-gray-400'
          } hover:text-green-400 transition`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs">Главная</span>
        </Link>
        <Link
          href="/dashboard/customer/drivers"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/dashboard/customer/drivers') ? 'text-green-400' : 'text-gray-400'
          } hover:text-green-400 transition`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-xs">Водители</span>
        </Link>
        <Link
          href="/dashboard/customer/orders"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/dashboard/customer/orders') ? 'text-green-400' : 'text-gray-400'
          } hover:text-green-400 transition`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-xs">Заказы</span>
        </Link>
        <Link
          href="/dashboard/customer/finance"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/dashboard/customer/finance') ? 'text-green-400' : 'text-gray-400'
          } hover:text-green-400 transition`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs">Финансы</span>
        </Link>
        <Link
          href="/dashboard/customer/tracking"
          className={`flex flex-col items-center justify-center flex-1 h-full ${
            isActive('/dashboard/customer/tracking') ? 'text-green-400' : 'text-gray-400'
          } hover:text-green-400 transition`}
        >
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs">Отслеживание</span>
        </Link>
      </div>
    </div>
  )
}

