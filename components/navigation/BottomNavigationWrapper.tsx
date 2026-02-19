'use client'

import { DriverBottomNavigation } from '@/components/driver/DriverBottomNavigation'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'
import { CustomerBottomNavigation } from '@/components/customer/CustomerBottomNavigation'

interface BottomNavigationWrapperProps {
  role: string
}

export function BottomNavigationWrapper({ role }: BottomNavigationWrapperProps) {
  switch (role) {
    case 'driver':
      return <DriverBottomNavigation />
    case 'client':
      return <ClientBottomNavigation />
    case 'customer':
      return <CustomerBottomNavigation />
    default:
      return null
  }
}

