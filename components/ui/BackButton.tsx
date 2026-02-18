'use client'

import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'

export function BackButton() {
  const router = useRouter()
  const pathname = usePathname()

  // Определяем, куда вести назад, в зависимости от текущего пути
  const getBackPath = () => {
    if (pathname?.includes('/admin/')) {
      return '/dashboard/admin'
    }
    if (pathname?.includes('/driver/')) {
      return '/dashboard/driver'
    }
    if (pathname?.includes('/customer/')) {
      return '/dashboard/customer'
    }
    if (pathname?.includes('/fleet/')) {
      return '/dashboard/fleet'
    }
    if (pathname?.includes('/client/')) {
      return '/dashboard/client'
    }
    // По умолчанию на главную дашборда
    return '/dashboard'
  }

  const handleBack = () => {
    router.push(getBackPath())
  }

  return (
    <button
      onClick={handleBack}
      className="mb-4 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
    >
      <svg
        className="w-5 h-5 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Назад
    </button>
  )
}




