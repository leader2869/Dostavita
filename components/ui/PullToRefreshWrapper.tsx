'use client'

import { PullToRefresh } from './PullToRefresh'
import { useRouter } from 'next/navigation'

export function PullToRefreshWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const handleRefresh = async () => {
    // Обновляем страницу
    router.refresh()
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      {children}
    </PullToRefresh>
  )
}

