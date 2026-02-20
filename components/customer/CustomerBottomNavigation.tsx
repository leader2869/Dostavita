'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCashDepositRequestsCount } from '@/hooks/useCashDepositRequestsCount'

export function CustomerBottomNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { count: pendingRequestsCount } = useCashDepositRequestsCount()

  const isActive = (path: string) => {
    if (path === '/dashboard/customer') {
      return pathname === '/dashboard/customer'
    }
    return pathname?.startsWith(path)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 z-[100]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          <Link
            href="/dashboard/customer"
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              isActive('/dashboard/customer') ? 'text-brand-light' : 'text-gray-600'
            } hover:text-brand-light transition`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Главная</span>
          </Link>
          <Link
            href="/dashboard/customer/orders"
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              isActive('/dashboard/customer/orders') ? 'text-brand-light' : 'text-gray-600'
            } hover:text-brand-light transition`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Заказы</span>
          </Link>
          {/* Центральная кнопка "П!" в круге - крупнее остальных */}
          <button
            onClick={() => router.push('/dashboard/customer/available-orders')}
            className={`relative w-20 h-20 rounded-full bg-brand-light text-gray-900 flex items-center justify-center shadow-lg hover:bg-brand-dark transition-all z-10 -mt-6 font-amatic-sc ${
              isActive('/dashboard/customer/available-orders') ? 'ring-2 ring-brand-light' : ''
            }`}
          >
            <span className="text-4xl font-bold">П!</span>
          </button>
          <Link
            href="/dashboard/customer/finance"
            className={`flex flex-col items-center justify-center flex-1 h-full relative ${
              isActive('/dashboard/customer/finance') ? 'text-brand-light' : 'text-gray-600'
            } hover:text-brand-light transition`}
          >
            <div className="relative inline-block">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-gray-900 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center min-w-[20px]">
                  {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                </span>
              )}
            </div>
            <span className="text-xs">Финансы</span>
          </Link>
          <Link
            href="/dashboard/customer/profile"
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              isActive('/dashboard/customer/profile') ? 'text-brand-light' : 'text-gray-600'
            } hover:text-brand-light transition`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs">Профиль</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

