'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface PullToRefreshProps {
  onRefresh?: () => void | Promise<void>
  children: React.ReactNode
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef<number>(0)
  const currentY = useRef<number>(0)
  const isPulling = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const PULL_THRESHOLD = 80 // Расстояние для активации обновления
  const MAX_PULL = 120 // Максимальное расстояние

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const getClientY = (e: TouchEvent | MouseEvent): number => {
      return 'touches' in e ? e.touches[0].clientY : e.clientY
    }

    const handleStart = (e: TouchEvent | MouseEvent) => {
      // Проверяем, что мы в самом верху страницы
      if (window.scrollY <= 0) {
        startY.current = getClientY(e)
        currentY.current = getClientY(e)
        isPulling.current = true
      }
    }

    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!isPulling.current) return

      currentY.current = getClientY(e)
      const distance = currentY.current - startY.current

      // Разрешаем pull только если мы в самом верху
      if (window.scrollY <= 0 && distance > 0) {
        if ('touches' in e) {
          e.preventDefault() // Предотвращаем стандартное поведение прокрутки только для touch
        }
        const pullDistance = Math.min(distance, MAX_PULL)
        setPullDistance(pullDistance)
      } else if (distance <= 0) {
        // Если пользователь потянул вверх, отменяем pull
        isPulling.current = false
        setPullDistance(0)
      }
    }

    const handleEnd = async () => {
      if (!isPulling.current) return

      isPulling.current = false

      if (pullDistance >= PULL_THRESHOLD) {
        setIsRefreshing(true)
        setPullDistance(0)

        try {
          if (onRefresh) {
            await onRefresh()
          } else {
            // По умолчанию обновляем страницу
            router.refresh()
          }
        } catch (error) {
          console.error('Ошибка при обновлении:', error)
        } finally {
          setIsRefreshing(false)
        }
      } else {
        // Плавно возвращаем в исходное положение
        setPullDistance(0)
      }
    }

    // Touch события (мобильные устройства)
    container.addEventListener('touchstart', handleStart as EventListener, { passive: false })
    container.addEventListener('touchmove', handleMove as EventListener, { passive: false })
    container.addEventListener('touchend', handleEnd as EventListener)

    // Mouse события (десктоп)
    container.addEventListener('mousedown', handleStart as EventListener)
    container.addEventListener('mousemove', handleMove as EventListener)
    container.addEventListener('mouseup', handleEnd as EventListener)
    container.addEventListener('mouseleave', handleEnd as EventListener)

    return () => {
      container.removeEventListener('touchstart', handleStart as EventListener)
      container.removeEventListener('touchmove', handleMove as EventListener)
      container.removeEventListener('touchend', handleEnd as EventListener)
      container.removeEventListener('mousedown', handleStart as EventListener)
      container.removeEventListener('mousemove', handleMove as EventListener)
      container.removeEventListener('mouseup', handleEnd as EventListener)
      container.removeEventListener('mouseleave', handleEnd as EventListener)
    }
  }, [pullDistance, onRefresh, router])

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1)
  const shouldShowIndicator = pullDistance > 0 || isRefreshing

  return (
    <div ref={containerRef} className="relative">
      {/* Индикатор обновления */}
      {shouldShowIndicator && (
        <div
          className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 transition-all duration-200"
          style={{
            transform: `translateY(${Math.max(0, pullDistance - 60)}px)`,
            opacity: pullProgress,
          }}
        >
          <div className="bg-white rounded-full shadow-lg p-3">
            {isRefreshing ? (
              <svg
                className="w-6 h-6 text-brand-light animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-brand-light transition-transform"
                style={{ transform: `rotate(${pullProgress * 180}deg)` }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Контент с трансформацией при pull */}
      <div
        style={{
          transform: `translateY(${Math.max(0, pullDistance)}px)`,
          transition: isRefreshing ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}

