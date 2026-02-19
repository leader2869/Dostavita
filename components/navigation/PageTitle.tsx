'use client'

import { usePathname } from 'next/navigation'

export function PageTitle() {
  const pathname = usePathname()

  const getPageTitle = () => {
    if (!pathname) return ''

    // Определяем название страницы по пути
    if (pathname === '/dashboard/client' || pathname === '/dashboard/client/') {
      return 'Главная'
    }
    if (pathname.startsWith('/dashboard/client/finance')) {
      return 'Финансы'
    }
    if (pathname.startsWith('/dashboard/client/orders')) {
      return 'Заказы'
    }
    if (pathname.startsWith('/dashboard/client/profile')) {
      return 'Профиль'
    }
    if (pathname.startsWith('/dashboard/client/create-order')) {
      return 'Отправить'
    }
    if (pathname.startsWith('/dashboard/client/orders/') && pathname.includes('/edit')) {
      return 'Редактировать заказ'
    }
                if (pathname.startsWith('/dashboard/client/orders/')) {
                  return 'Детали'
                }
                
                // Для водителя
                // Проверяем более специфичные пути первыми
                if (pathname.startsWith('/dashboard/driver/orders/')) {
                  return 'Детали'
                }
    if (pathname.startsWith('/dashboard/driver/profile')) {
      return 'Профиль'
    }
    if (pathname.startsWith('/dashboard/driver/finance')) {
      return 'Финансы'
    }
    if (pathname.startsWith('/dashboard/driver/my-orders')) {
      return 'Мои заказы'
    }
    if (pathname === '/dashboard/driver' || pathname === '/dashboard/driver/') {
      return 'Главная'
    }
    
                // Для организации
                // Проверяем более специфичные пути первыми
                if (pathname.startsWith('/dashboard/customer/orders/')) {
                  return 'Детали'
                }
    if (pathname.startsWith('/dashboard/customer/drivers/')) {
      return 'Профиль водителя'
    }
    if (pathname.startsWith('/dashboard/customer/create-order')) {
      return 'Отправить'
    }
    if (pathname.startsWith('/dashboard/customer/finance')) {
      return 'Финансы'
    }
    if (pathname.startsWith('/dashboard/customer/orders') && !pathname.includes('/orders/')) {
      return 'Заказы'
    }
    if (pathname.startsWith('/dashboard/customer/drivers')) {
      return 'Управление водителями'
    }
    if (pathname.startsWith('/dashboard/customer/tracking')) {
      return 'Отслеживание водителей'
    }
    if (pathname === '/dashboard/customer' || pathname === '/dashboard/customer/') {
      return 'Главная'
    }
    
    // Для админа
    if (pathname.startsWith('/dashboard/admin/orders')) {
      return 'Управление заказами'
    }
    if (pathname.startsWith('/dashboard/admin')) {
      return 'Админ панель'
    }

    return ''
  }

  const pageTitle = getPageTitle()

  if (!pageTitle) return null

  return (
    <span className="text-4xl font-bold text-brand-light ml-2" style={{ fontFamily: 'var(--font-amatic-sc), cursive' }}>
      {pageTitle}
    </span>
  )
}

