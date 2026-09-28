'use client'

import dynamic from 'next/dynamic'

const DriverLocationMap = dynamic(
  () => import('@/components/map/DriverLocationMap').then(module => module.DriverLocationMap),
  { ssr: false }
)

interface DriverLocationMapWrapperProps {
  driverId: string
  orderId?: string
  height?: string
  zoom?: number
}

/**
 * Обертка для DriverLocationMap для использования в серверных компонентах
 */
export function DriverLocationMapWrapper({
  driverId,
  orderId,
  height = '400px',
  zoom = 15,
}: DriverLocationMapWrapperProps) {
  return (
    <DriverLocationMap
      driverId={driverId}
      orderId={orderId}
      height={height}
      zoom={zoom}
    />
  )
}

