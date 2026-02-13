'use client'

import { DriverLocationTracker } from './DriverLocationTracker'

/**
 * Обертка для страницы водителя, которая включает отслеживание местоположения
 */
export function DriverDashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DriverLocationTracker />
    </>
  )
}

