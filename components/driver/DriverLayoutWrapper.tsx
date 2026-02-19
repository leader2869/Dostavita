'use client'

import { NewOrderNotification } from './NewOrderNotification'

export function DriverLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <NewOrderNotification />
    </>
  )
}

